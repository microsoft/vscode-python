// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import fastXmlParser from 'fast-xml-parser';
import fs from 'fs';

export class TestBenchmark {
    public name: string;
    public time: number;
}

const xmlFile = '../test-results.xml';

fs.readFile(xmlFile, 'utf8', (err, data) => {
    if (err) {
        throw err;
    }

    const JsonOutput: TestBenchmark[] = [];

    if (fastXmlParser.validate(data)) {
        const defaultOptions = {
            attributeNamePrefix: '',
            ignoreAttributes: false
        };
        const jsonObj = fastXmlParser.parse(data, defaultOptions);

        jsonObj.testsuites.testsuite.forEach(suite => {
            if (parseInt(suite.tests, 10) > 0) {
                if (Array.isArray(suite.testcase)) {
                    suite.testcase.forEach(testcase => {
                        const test: TestBenchmark = {
                            name: testcase.name,
                            time: parseFloat(testcase.time)
                        };
                        JsonOutput.push(test);
                    });
                } else {
                    const test: TestBenchmark = {
                        name: suite.testcase.name,
                        time: parseFloat(suite.testcase.time)
                    };
                    JsonOutput.push(test);
                }
            }
        });
    }

    fs.writeFile('./test-results.json', JSON.stringify(JsonOutput, null, 2), writeResultsError => {
        if (writeResultsError) {
            throw writeResultsError;
        }
        // tslint:disable-next-line: no-console
        console.log('The file was saved!');
    });
});
