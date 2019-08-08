// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as util from 'util';
import { uitestsRootPath } from './constants';
import { noop } from './helpers';
import { debug } from './helpers/logger';
import { addReportMetadata, generateHtmlReport, generateJUnitReport } from './helpers/report';
import { getTestOptions } from './setup';
import { WorldParameters } from './steps/types';
import { Channel, ITestOptions } from './types';

// tslint:disable-next-line: no-var-requires no-require-imports
const Cli = require('cucumber/lib/cli');

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

export async function start(
    channel: Channel,
    testDir: string,
    verboseLogging: boolean,
    pythonPath: string,
    cucumberArgs: string[]
) {
    const options = getTestOptions(channel, testDir, pythonPath, verboseLogging);
    await initialize(options);
    await fs.ensureDir(options.reportsPath);

    const worldParameters: WorldParameters = { channel, testDir, verboseLogging, pythonPath };
    const reportFileName = `cucumber_report_${new Date().getTime()}.json`;
    const args: string[] = [
        '', // Leave empty (not used by cucmberjs)
        '', // Leave empty (not used by cucmberjs)
        'features',
        '--require-module',
        'source-map-support/register',
        '-r',
        'out/steps/**/*.js',
        '--format',
        'node_modules/cucumber-pretty',
        '--format',
        `json:.vscode test/reports/${reportFileName}`,
        '--world-parameters',
        JSON.stringify(worldParameters),
        ...cucumberArgs
    ];
    const cli = new Cli.default({ argv: args, cwd: uitestsRootPath, stdout: process.stdout });
    // tslint:disable-next-line: no-console
    const result = await cli.run().catch(console.error);

    // Generate necessary reports.
    const jsonReportFilePath = path.join(options.reportsPath, reportFileName);
    await addReportMetadata(options, jsonReportFilePath);
    await Promise.all([
        generateHtmlReport(options, jsonReportFilePath),
        generateJUnitReport(options, jsonReportFilePath)
    ]);

    // Bye bye.
    if (!result.success) {
        throw new Error(`Error in running UI Tests. ${util.format(result)}`);
    }
}
