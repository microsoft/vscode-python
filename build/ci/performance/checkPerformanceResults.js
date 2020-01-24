// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fastXmlParser = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

const xmlFile = path.join(constants.ExtensionRootDir, 'test-results.xml');
const performanceResultsFile = path.join(constants.ExtensionRootDir, 'build', 'ci', 'performance', 'performance-results.json');
const errorMargin = 0.01;
let failedTests = '';

fs.readFile(xmlFile, 'utf8', (xmlFileError, xmlData) => {
    if (xmlFileError) {
        throw xmlFileError;
    }

    if (fastXmlParser.validate(xmlData)) {
        const defaultOptions = {
            attributeNamePrefix: '',
            ignoreAttributes: false
        };

        fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
            if (performanceResultsFileError) {
                throw performanceResultsFileError;
            }

            const resultsJson = fastXmlParser.parse(xmlData, defaultOptions);
            const performanceJson = JSON.parse(performanceData);

            performanceJson.forEach(result => {
                const avg = result.times.reduce((a, b) => parseFloat(a) + parseFloat(b)) / result.times.length;

                resultsJson.testsuites.testsuite.forEach(suite => {
                    if (parseInt(suite.tests, 10) > 0) {
                        if (Array.isArray(suite.testcase)) {
                            const testcase = suite.testcase.find(x => x.name === result.name);

                            // compare the average result to the base JSON
                            if (testcase && avg > parseFloat(testcase.time) + errorMargin) {
                                failedTests += 'Performance is slow in: ' + testcase.name + ', Benchmark time: ' + testcase.time + ', Average test time: ' + avg + '\n';
                            }
                        } else {
                            // compare the average result to the base JSON
                            if (suite.testcase.name === result.name && avg > parseFloat(suite.testcase.time) + errorMargin) {
                                failedTests += 'Performance is slow in: ' + testcase.name + ', Benchmark time: ' + testcase.time + ', Average test time: ' + avg + '\n';
                            }
                        }
                    }
                });
            });

            if (failedTests.length > 0) {
                throw new Error(failedTests);
            }

            // Delete performance-results.json
            fs.unlink(performanceResultsFile, deleteError => {
                if (deleteError) {
                    throw deleteError;
                }
            });
        });
    }
});
