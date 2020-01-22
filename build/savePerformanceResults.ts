// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import fastXmlParser from 'fast-xml-parser';
import fs from 'fs';

export class PerformanceResults {
    public name: string;
    public times: number[];
}

const xmlFile = '../test-results.xml';
const jsonFile = './performance-results.json';
let jsonData: PerformanceResults[] = [];

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

                jsonObj.testsuites.testsuite.forEach(suite => {
                    if (parseInt(suite.tests, 10) > 0) {
                        if (Array.isArray(suite.testcase)) {
                            suite.testcase.forEach(testcase => {
                                const test: PerformanceResults = {
                                    name: testcase.name,
                                    times: [testcase.time]
                                };
                                jsonData.push(test);
                            });
                        } else {
                            const test = {
                                name: suite.testcase.name,
                                times: [suite.testcase.time]
                            };
                            jsonData.push(test);
                        }
                    }
                });
            } else {
                jsonData = JSON.parse(data);

                jsonObj.testsuites.testsuite.forEach(suite => {
                    if (parseInt(suite.tests, 10) > 0) {
                        if (Array.isArray(suite.testcase)) {
                            suite.testcase.forEach(testcase => {
                                let test = jsonData.find(x => x.name === testcase.name);
                                if (test) {
                                    // if the test name is already there, we add the new time
                                    test.times.push(parseFloat(testcase.time));
                                } else {
                                    // if its not there, we add the whole thing
                                    test = {
                                        name: testcase.name,
                                        times: [parseFloat(testcase.time)]
                                    };

                                    jsonData.push(test);
                                }
                            });
                        } else {
                            let test = jsonData.find(x => x.name === suite.testcase.name);
                            if (test) {
                                // if the test name is already there, we add the new time
                                test.times.push(parseFloat(suite.testcase.time));
                            } else {
                                // if its not there, we add the whole thing
                                test = {
                                    name: suite.testcase.name,
                                    times: [parseFloat(suite.testcase.time)]
                                };

                                jsonData.push(test);
                            }
                        }
                    }
                });
            }
        });
    }

    fs.writeFile('./performance-results.json', JSON.stringify(jsonData, null, 2), writeResultsError => {
        if (writeResultsError) {
            throw writeResultsError;
        }
        // tslint:disable-next-line: no-console
        console.log('The file was saved!');
    });
});
