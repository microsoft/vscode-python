// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import fs from 'fs';
import { PerformanceResults } from './savePerformanceResults';
import { TestBenchmark } from './xml2json';

const performanceResultsFile = './performance-results.json';
const baseFile = './test-results.json';
const errorMargin = 0.01;
let testsWereAdded = false;

fs.readFile(baseFile, 'utf8', (baseFileError, baseData) => {
    if (baseFileError) {
        throw baseFileError;
    }

    fs.readFile(performanceResultsFile, 'utf8', (performanceResultsFileError, performanceData) => {
        if (performanceResultsFileError) {
            throw performanceResultsFileError;
        }

        const baseJson: TestBenchmark[] = JSON.parse(baseData);
        const performanceJson: PerformanceResults[] = JSON.parse(performanceData);

        performanceJson.forEach(result => {
            const avg = result.times.reduce((a, b) => a + b) / result.times.length;
            const testcase = baseJson.find(x => x.name === result.name);

            if (testcase) {
                // compare the average result to the base JSON
                if (avg > testcase.time + errorMargin) {
                    // test performance is slow
                } else {
                    // test performance is ok
                }
            } else {
                // since there's no data, add the average result to the base JSON
                testsWereAdded = true;
                const newTest: TestBenchmark = {
                    name: result.name,
                    time: avg
                };
                baseJson.push(newTest);
            }
        });

        if (testsWereAdded) {
            fs.writeFile('./test-results.json', JSON.stringify(baseJson, null, 2), writeResultsError => {
                if (writeResultsError) {
                    throw writeResultsError;
                }
                // tslint:disable-next-line: no-console
                console.log('The file was saved!');
            });
        }
    });
});
