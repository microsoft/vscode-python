// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { uitestsRootPath } from './constants';
import { noop } from './helpers';
import { debug } from './helpers/logger';
import { addReportMetadata, generateHtmlReport, generateJUnitReport } from './helpers/report';
import { getTestOptions } from './setup';
import { WorldParameters } from './steps/types';
import { Channel, ITestOptions } from './types';

// tslint:disable-next-line: no-var-requires no-require-imports
const Cli = require('cucumber/lib/cli');

const retryCount = 3;
// If we have a large number of tests, and a large nuber of them failed.
// Then lets not retry, fix the flaky tests.
// Lets allow only 25% failure rate to allow retries.
const failureThresholdToRetry = 0.25;
// If total number of tests is <= 10, then retry, no matter how many failed.
// I.e. even if all 10 failed, try again (we're assuming these are small tests)
const maxTestsToRetryAll = 10;

export async function initialize(options: ITestOptions) {
    // Delete all old test related stuff.
    debug('Deleting old test data');
    await Promise.all([
        fs.remove(options.tempPath).catch(noop),
        fs.remove(options.reportsPath).catch(noop),
        fs.remove(options.logsPath).catch(noop),
        fs.remove(options.screenshotsPath).catch(noop),
        fs.remove(options.userDataPath).catch(noop)
    ]);
}

type Scenario = {
    id: string;
    name: string;
    tags: [{ name: string; line: number }];
    line: number;
    steps: [{ result: { status: 'passed' | 'other' } }];
};
type CucumberReport = [{ id: string; elements: [Scenario] }];
type CucumberReportStats = { total: number; failed: number };

type CucumberResults = {
    success: boolean;
    jsonReportFile: string;
    rerunFile: string;
    stats?: CucumberReportStats;
};

async function parseCucumberJson(jsonFile: string): Promise<CucumberReport> {
    return JSON.parse(await fs.readFile(jsonFile, 'utf8'));
}
function hasScenarioPassed(scenario: Scenario): boolean {
    return scenario.steps.every(step => step.result.status === 'passed');
}
async function findScenario(report: CucumberReport, featureId: string, scenarioId: string, line: number): Promise<Scenario> {
    for (const feature of report) {
        if (feature.id !== featureId) {
            continue;
        }
        const found = feature.elements.find(scenario => scenario.id === scenarioId && scenario.line === line);
        if (found) {
            return found;
        }
    }
    throw new Error(`Feature & Scenario not found. FeatureId = ${featureId}, ScenarioId = ${scenarioId}, line = ${line}`);
}

async function getCucumberResultStats(json: CucumberReport): Promise<CucumberReportStats> {
    const report = { total: 0, failed: 0 };
    json.forEach(feature =>
        feature.elements.forEach(scenario => {
            report.total += 1;
            report.failed += hasScenarioPassed(scenario) ? 0 : 1;
        })
    );
    return report;
}
async function shouldRerunTests(results: CucumberResults): Promise<boolean> {
    if (results.success || !results.stats) {
        // tslint:disable-next-line: no-console
        console.info('Not retrying, as there are no stats');
        return false;
    }

    // If we have just <= 10 tests, then always retry.
    if (results.stats.total <= maxTestsToRetryAll) {
        return true;
    }

    if (results.stats.failed / results.stats.total < failureThresholdToRetry) {
        return true;
    }
    // tslint:disable-next-line: no-console
    console.info(`Not retrying, as there are too many failures ${results.stats.failed}/${results.stats.total}`);
    return false;
}

export async function start(channel: Channel, testDir: string, verboseLogging: boolean, pythonPath: string, cucumberArgs: string[]) {
    const options = getTestOptions(channel, testDir, pythonPath, verboseLogging);
    await initialize(options);
    await fs.ensureDir(options.reportsPath);

    const worldParameters: WorldParameters = { channel, testDir, verboseLogging, pythonPath };
    const results = await runCucumber(cucumberArgs, worldParameters);
    const rerunFilesToDelete = [results.rerunFile];
    let rerunFule = results.rerunFile;
    let success = results.success;

    // if failed, then re-run the failed tests.
    if (await shouldRerunTests(results)) {
        try {
            for (let retry = 1; retry <= retryCount; retry += 1) {
                // tslint:disable-next-line: no-console
                console.info(`Rerunning tests (retry #${retry})`);
                const cucumberArgsWithoutTags = cucumberArgs.filter(arg => !arg.startsWith('--tags'));
                const rerunResults = await runCucumber(cucumberArgsWithoutTags, worldParameters, rerunFule);
                rerunFilesToDelete.push(rerunResults.rerunFile);
                // if some tests passed in the re-run, then update those tests in the original report as having succeeded.
                const rerurnJson = await parseCucumberJson(rerunResults.jsonReportFile);
                const originalJson = await parseCucumberJson(results.jsonReportFile);
                let originalJsonUpdated = false;
                for (const feature of rerurnJson) {
                    for (const scenario of feature.elements) {
                        if (hasScenarioPassed(scenario)) {
                            const originalScenario = await findScenario(originalJson, feature.id, scenario.id, scenario.line);
                            Object.keys(scenario).forEach(key => {
                                // tslint:disable-next-line: no-any
                                (originalScenario as any)[key] = (scenario as any)[key];
                            });
                            // Keep track of the fact that this was successful only after a retry.
                            originalScenario.name += ` (Retry ${retry})`;
                            originalScenario.tags.push({ name: `retry${retry}`, line: 0 });
                            originalJsonUpdated = true;
                        }
                    }
                }

                if (originalJsonUpdated) {
                    await fs.writeFile(results.jsonReportFile, JSON.stringify(originalJson));
                }
                if (rerunResults.success) {
                    success = true;
                    break;
                }
                // Set rerun file for next retry.
                rerunFule = rerunResults.rerunFile;

                // If only 10 failed, we can retry, event if this is the same 10 that we retried.
                // Its small enough to retry again.
                if (rerunResults.stats && rerunResults.stats.failed <= maxTestsToRetryAll) {
                    continue;
                }
                // If all tests that were supposed to be rerun failed, then don't bother trying again.
                if (!results.stats || !rerunResults.stats || rerunResults.stats.failed === results.stats.failed) {
                    break;
                }
                continue;
            }
        } catch (ex) {
            // tslint:disable-next-line: no-console
            console.error('Rerun failed', ex);
        }
    }

    // Delete all the rerun files that were created in root directory.
    await Promise.all(rerunFilesToDelete.map(item => fs.unlink(item).catch(noop)));

    // Generate necessary reports.
    const jsonReportFilePath = results.jsonReportFile;
    await addReportMetadata(options, jsonReportFilePath);
    await Promise.all([generateHtmlReport(options, jsonReportFilePath), generateJUnitReport(options, jsonReportFilePath)]);

    // Bye bye.
    if (!success) {
        throw new Error('Error in running UI Tests');
    }
}

async function runCucumber(cucumberArgs: string[], worldParameters: WorldParameters, rerunFile?: string): Promise<CucumberResults> {
    const jsonReportFile = path.join(uitestsRootPath, '.vscode test', 'reports', `cucumber_report_${new Date().getTime()}.json`);
    const newRerunFile = `@rerun${new Date().getTime()}.txt`;
    const args: string[] = [
        '', // Leave empty (not used by cucmberjs)
        '', // Leave empty (not used by cucmberjs)
        // If we have a rerun file, use that else run all features in `features` folder.
        rerunFile || 'features',
        '--require-module',
        'source-map-support/register',
        '-r',
        'out/steps/**/*.js',
        '--format',
        'node_modules/cucumber-pretty',
        '--format',
        `rerun:${newRerunFile}`,
        '--format',
        `json:${jsonReportFile}`,
        '--world-parameters',
        JSON.stringify(worldParameters),
        ...cucumberArgs
    ];

    let success = true;
    if (rerunFile) {
        // When this is a rerun, then spanw a node process to run cucumber.
        // We cannot re-run cucumber in the same process more than once.
        // It seems to maintain some global state.
        // Cucumberjs isn't designed to be run more than once in same process, its meant to be run via its cli.
        // const proc = spawn(process.execPath, ['./node_modules/.bin/cucumber-js', ...args.slice(2)], {
        const cucumberjsPath = path.join(uitestsRootPath, 'node_modules', 'cucumber', 'bin', 'cucumber-js');
        const proc = spawn(process.execPath, [cucumberjsPath, ...args.slice(2)], {
            cwd: uitestsRootPath
        });
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
        const exitCode = await new Promise<number>(resolve => proc.once('exit', resolve));
        success = exitCode === 0;
    } else {
        // This is a hack, reunnin cucumberjs like this, but allows us to  debug it and have our own code run as part of the test initialization.
        const cli = new Cli.default({ argv: args, cwd: uitestsRootPath, stdout: process.stdout });
        // tslint:disable-next-line: no-console
        const result = await cli.run().catch(console.error);
        success = result.success;
    }

    let stats;
    if (fs.pathExists(jsonReportFile)) {
        const json = await parseCucumberJson(jsonReportFile);
        stats = await getCucumberResultStats(json);
    }
    return {
        success,
        jsonReportFile,
        rerunFile: newRerunFile,
        stats
    };
}
