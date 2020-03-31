// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fastXmlParser = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

const xmlFile = path.join(constants.ExtensionRootDir, 'xunit-test-results.xml');
const jsonFile = path.join(constants.ExtensionRootDir, 'build', 'ci', 'performance', 'performance-results.json');
let performanceData = [];

fs.readFile(xmlFile, 'utf8', (xmlReadError, xmlData) => {
    if (xmlReadError) {
        throw xmlReadError;
    }

    if (fastXmlParser.validate(xmlData)) {
        const defaultOptions = {
            attributeNamePrefix: '',
            ignoreAttributes: false
        };
        const jsonObj = fastXmlParser.parse(xmlData, defaultOptions);

        fs.readFile(jsonFile, 'utf8', (jsonReadError, data) => {
            if (jsonReadError) {
                // File doesn't exist, so we create it
                jsonObj.testsuite.testcase.forEach((testcase) => {
                    const test = {
                        name: testcase.classname + ' ' + testcase.name,
                        times: [testcase.failure || testcase.skipped === '' ? -1 : parseFloat(testcase.time)]
                    };

                    performanceData.push(test);
                });
            } else {
                performanceData = JSON.parse(data);

                jsonObj.testsuite.testcase.forEach((testcase) => {
                    let test = performanceData.find((x) => x.name === testcase.classname + ' ' + testcase.name);
                    let time = testcase.failure || testcase.skipped === '' ? -1 : parseFloat(testcase.time);

                    if (test) {
                        // if the test name is already there, we add the new time
                        test.times.push(time);
                    } else {
                        // if its not there, we add the whole thing
                        const test = {
                            name: testcase.classname + ' ' + testcase.name,
                            times: [time]
                        };

                        performanceData.push(test);
                    }
                });
            }

            fs.writeFile(
                path.join(constants.ExtensionRootDir, 'build', 'ci', 'performance', 'performance-results.json'),
                JSON.stringify(performanceData, null, 2),
                (writeResultsError) => {
                    if (writeResultsError) {
                        throw writeResultsError;
                    }
                    console.log('performance-results.json was saved!');
                }
            );
        });
    }
});
