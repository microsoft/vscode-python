// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { ITestOptions } from '../types';
import { getOSType, OSType } from './misc';

// tslint:disable: no-var-requires no-require-imports no-any
const report = require('multiple-cucumber-html-reporter');
const cucumberJunit = require('cucumber-junit');
const reporter = require('cucumber-html-reporter');

const OS = {
    [OSType.Linux]: '🐧 Linux',
    [OSType.OSX]: '🍎 Mac',
    [OSType.Windows]: '🖥 Win'
};

export async function generateJUnitReport(options: ITestOptions, cucumberReportJsonFilePath: string) {
    const content = await fs.readFile(cucumberReportJsonFilePath);
    const xml = cucumberJunit(content, { strict: true });
    await fs.writeFile(path.join(options.reportsPath, 'report.xml'), xml);
}

function getMetadata(options: ITestOptions) {
    return [
        { name: 'OS', value: OS[getOSType()] },
        { name: 'VS Code', value: options.channel },
        { name: 'Build', value: process.env.AgentJobName },
        { name: 'Python', value: process.env.PYTHON_VERSION }
    ];
}

/**
 * Add metadata into the JSON report.
 * Useful for later (when we merge all reports into one and generate html reports).
 *
 * @export
 * @param {ITestOptions} options
 * @param {string} cucumberReportJsonFilePath
 */
export async function addReportMetadata(options: ITestOptions, cucumberReportJsonFilePath: string) {
    const metadata = getMetadata(options);

    // Write custom metadata (make it part of Json report for later use).
    // This way cucumber report has the data.
    const reportData = JSON.parse(await fs.readFile(cucumberReportJsonFilePath, 'utf8'));
    for (const item of reportData) {
        item.metadata = JSON.parse(JSON.stringify(metadata));
    }
    await fs.writeFile(cucumberReportJsonFilePath, JSON.stringify(reportData));
}

/**
 * Generate HTML report.
 * (store metadata into cucumber json report for when multiple reports are merged into one).
 *
 * @export
 * @param {ITestOptions} options
 * @param {string} cucumberReportJsonFilePath
 */
export async function generateHtmlReport(options: ITestOptions, cucumberReportJsonFilePath: string) {
    // Generate the report.
    const htmlFile = path.join(options.reportsPath, 'index.html');
    const reportOptions = {
        name: 'Python VS Code',
        brandTitle: 'UI Tests',
        theme: 'hierarchy',
        jsonFile: cucumberReportJsonFilePath,
        output: htmlFile,
        reportSuiteAsScenarios: true,
        launchReport: false,
        metadata: {}
    };
    getMetadata(options).forEach(item => ((reportOptions.metadata as any)[item.name] = item.value));
    reporter.generate(reportOptions);
}

/**
 * Merge multiple cucumber reports into one.
 * (we expect metadata to be stored in cucumber json).
 *
 * @export
 * @param {string} cucumberReportsPath
 * @param {string} outputDir
 */
export async function mergeAndgenerateHtmlReport(cucumberReportsPath: string, outputDir: string) {
    report.generate({
        jsonDir: cucumberReportsPath,
        reportPath: outputDir,
        pageTitle: 'Python VS Code',
        reportName: 'UI Tests',
        customMetadata: true,
        displayDuration: true
    });
}
