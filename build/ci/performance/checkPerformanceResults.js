// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

const benchmark = process.argv.slice(2).join(' ');
const performanceResultsFile = path.join(
    constants.ExtensionRootDir,
    'build',
    'ci',
    'performance',
    'performance-results.json'
);
let failedTests = '';

fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
    if (performanceResultsFileError) {
        throw performanceResultsFileError;
    }

    const benchmarkJson = JSON.parse(benchmark);
    const performanceJson = JSON.parse(performanceData);

    performanceJson.forEach((result) => {
        const cleanTimes = result.times.filter((x) => x !== -1 && x !== -10);
        const n = cleanTimes.length;
        const avg = n === 0 ? 0 : cleanTimes.reduce((a, b) => parseFloat(a) + parseFloat(b)) / n;
        const standardDev = Math.sqrt(
            cleanTimes.map((x) => Math.pow(parseFloat(x) - avg, 2)).reduce((a, b) => a + b) / n
        );
        const testcase = benchmarkJson.find((x) => x.name === result.name);

        if (testcase && testcase.time !== -1) {
            if (n === 0) {
                if (result.times.every((t) => t === -1)) {
                    // Test was skipped every time
                    failedTests += 'Skipped every time: ' + testcase.name + '\n';
                } else if (result.times.every((t) => t === -10)) {
                    // Test failed every time
                    failedTests += 'Failed every time: ' + testcase.name + '\n';
                }
            } else if (avg > parseFloat(testcase.time) + standardDev) {
                const skippedTimes = result.times.filter((t) => t === -1);
                const failedTimes = result.times.filter((t) => t === -10);

                failedTests +=
                    'Performance is slow in: ' +
                    testcase.name +
                    '.\n\tBenchmark time: ' +
                    testcase.time +
                    '\n\tStandard Deviation:' +
                    standardDev +
                    '\n\tAverage test time: ' +
                    avg +
                    '\n\tTimes it was skipped: ' +
                    skippedTimes.length +
                    '\n\tTimes it failed: ' +
                    failedTimes.length +
                    '\n';
            }
        }
    });

    // Delete performance-results.json
    fs.unlink(performanceResultsFile, (deleteError) => {
        if (deleteError) {
            if (failedTests.length > 0) {
                console.log(failedTests);
            }
            throw deleteError;
        }
    });

    if (failedTests.length > 0) {
        throw new Error(failedTests);
    }
});
