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
const errorMargin = 0.01;
let failedTests = '';

fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
    if (performanceResultsFileError) {
        throw performanceResultsFileError;
    }

    const benchmarkJson = JSON.parse(benchmark);
    const performanceJson = JSON.parse(performanceData);

    performanceJson.forEach(result => {
        const avg = result.times.reduce((a, b) => parseFloat(a) + parseFloat(b)) / result.times.length;
        const testcase = benchmarkJson.find(x => x.name === result.name);

        // compare the average result to the base JSON
        if (testcase && testcase.time !== -1 && avg > parseFloat(testcase.time) + errorMargin) {
            console.log(testcase);
            failedTests +=
                'Performance is slow in: ' +
                testcase.name +
                ', Benchmark time: ' +
                testcase.time +
                ', Average test time: ' +
                avg +
                '\n';
        }
    });

    // Delete performance-results.json
    fs.unlink(performanceResultsFile, deleteError => {
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
