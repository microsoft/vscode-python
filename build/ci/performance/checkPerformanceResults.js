// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fs = require('fs');

const performanceResultsFile = './performance-results.json';
const resultsFile = './test-results.json';
const errorMargin = 0.01;
let testsWereAdded = false;
let failedTests = '';

fs.readFile(resultsFile, 'utf8', (resultsFileError, resultsData) => {
    if (resultsFileError) {
        throw resultsFileError;
    }

    fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
        if (performanceResultsFileError) {
            throw performanceResultsFileError;
        }

        const resultsJson = JSON.parse(resultsData);
        const performanceJson = JSON.parse(performanceData);

        performanceJson.forEach(result => {
            const avg = result.times.reduce((a, b) => parseFloat(a) + parseFloat(b)) / result.times.length;
            const testcase = resultsJson.find(x => x.name === result.name);

            if (testcase) {
                // compare the average result to the base JSON
                if (avg > testcase.time + errorMargin) {
                    failedTests += 'Performance is slow in: ' + testcase.name + ' , Benchmark time: ' + testcase.time + ' , Average test time: ' + avg + '\n';
                }
            } else {
                // since there's no data, add the average result to the base JSON
                testsWereAdded = true;
                const newTest = {
                    name: result.name,
                    time: avg
                };
                resultsJson.push(newTest);
            }
        });

        if (testsWereAdded) {
            fs.writeFile('./test-results.json', JSON.stringify(resultsJson, null, 2), writeResultsError => {
                if (writeResultsError) {
                    throw writeResultsError;
                }
                // tslint:disable-next-line: no-console
                console.log('test-results.json was updated!');
            });
        }

        if (failedTests.length > 0) {
            throw new Error(failedTests);
        }
    });
});
