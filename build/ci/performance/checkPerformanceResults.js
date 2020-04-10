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
const errorMargin = 1.1;
let failedTests = '';

function getFailingTimesString(missedTimes) {
    let printValue = '';
    for (const time of missedTimes) {
        printValue += String(time) + ', ';
    }
    return printValue.substring(0, printValue.length - 2);
}

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
        const standardDev =
            n === 0
                ? 0
                : Math.sqrt(cleanTimes.map((x) => Math.pow(parseFloat(x) - avg, 2)).reduce((a, b) => a + b) / n);
        const testcase = benchmarkJson.find((x) => x.name === result.name);

        if (testcase && testcase.time !== -1) {
            if (n === 0) {
                // if (result.times.every((t) => t === -1)) {
                //     // Test was skipped every time
                //     failedTests += 'Skipped every time: ' + testcase.name + '\n';
                // } else
                if (result.times.every((t) => t === -10)) {
                    // Test failed every time
                    failedTests += 'Failed every time: ' + testcase.name + '\n';
                }
            } else {
                // if (avg > parseFloat(testcase.time) + standardDev) {
                let missedTimes = [];
                for (let time of cleanTimes) {
                    if (parseFloat(time) > parseFloat(testcase.time) * errorMargin) {
                        missedTimes.push(parseFloat(time));
                    }
                }

                if (missedTimes.length >= 2) {
                    const skippedTimes = result.times.filter((t) => t === -1);
                    const failedTimes = result.times.filter((t) => t === -10);

                    failedTests +=
                        'Performance is slow in: ' +
                        testcase.name +
                        '.\n\tBenchmark time: ' +
                        String(parseFloat(testcase.time) * errorMargin) +
                        '\n\tTimes the test missed the benchmark: ' +
                        missedTimes.length +
                        '\n\tFailing times: ' +
                        getFailingTimesString(missedTimes) +
                        '\n\tTimes it was skipped: ' +
                        skippedTimes.length +
                        '\n\tTimes it failed: ' +
                        failedTimes.length +
                        '\n';
                }
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
