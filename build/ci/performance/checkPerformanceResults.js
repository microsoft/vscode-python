// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

const benchmarkFile = path.join(constants.ExtensionRootDir, 'build', 'ci', 'performance', 'DS_test_benchmark.json');
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

fs.readFile(benchmarkFile, 'utf8', (benchmarkError, benchmark) => {
    if (benchmarkError) {
        throw benchmarkError;
    }

    fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
        if (performanceResultsFileError) {
            throw performanceResultsFileError;
        }

        const benchmarkJson = JSON.parse(benchmark);
        const performanceJson = JSON.parse(performanceData);

        performanceJson.forEach((result) => {
            const cleanTimes = result.times.filter((x) => x !== 'S' && x !== 'F');
            const n = cleanTimes.length;
            const testcase = benchmarkJson.find((x) => x.name === result.name);

            if (testcase && testcase.time !== 'S') {
                if (n === 0 && result.times.every((t) => t === 'F')) {
                    // Test failed every time
                    failedTests += 'Failed every time: ' + testcase.name + '\n';
                } else {
                    let missedTimes = [];
                    for (let time of cleanTimes) {
                        if (parseFloat(time) > parseFloat(testcase.time) * errorMargin) {
                            missedTimes.push(parseFloat(time));
                        }
                    }

                    if (missedTimes.length >= 2) {
                        const skippedTimes = result.times.filter((t) => t === 'S');
                        const failedTimes = result.times.filter((t) => t === 'F');

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
});
