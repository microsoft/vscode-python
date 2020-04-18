// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const fastXmlParser = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

const xmlFile = path.join(constants.ExtensionRootDir, 'xunit-test-results.xml');
let performanceData = [];

function getTime(testcase) {
    if (testcase.failure) {
        return 'F';
    } else if (testcase.skipped === '') {
        return 'S';
    }
    return parseFloat(testcase.time);
}

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

        jsonObj.testsuite.testcase.forEach((testcase) => {
            const test = {
                name: testcase.classname + ' ' + testcase.name,
                time: getTime(testcase)
            };

            if (test.time !== 'S' && test.time > 0.1) {
                performanceData.push(test);
            }
        });

        fs.writeFile(
            path.join(constants.ExtensionRootDir, 'build', 'ci', 'performance', 'DS_test_benchmark.json'),
            JSON.stringify(performanceData, null, 2),
            (writeResultsError) => {
                if (writeResultsError) {
                    throw writeResultsError;
                }
                console.log('DS_test_benchmark.json was saved!');
            }
        );
    }
});
