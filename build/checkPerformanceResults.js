// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var fs_1 = __importDefault(require("fs"));
var performanceResultsFile = './performance-results.json';
var baseFile = './test-results.json';
var errorMargin = 0.01;
var testsWereAdded = false;
fs_1["default"].readFile(baseFile, 'utf8', function (baseFileError, baseData) {
    if (baseFileError) {
        throw baseFileError;
    }
    fs_1["default"].readFile(performanceResultsFile, 'utf8', function (performanceResultsFileError, performanceData) {
        if (performanceResultsFileError) {
            throw performanceResultsFileError;
        }
        var baseJson = JSON.parse(baseData);
        var performanceJson = JSON.parse(performanceData);
        performanceJson.forEach(function (result) {
            var avg = result.times.reduce(function (a, b) { return a + b; }) / result.times.length;
            var testcase = baseJson.find(function (x) { return x.name === result.name; });
            if (testcase) {
                // compare the average result to the base JSON
                if (avg > testcase.time + errorMargin) {
                    // test performance is slow
                }
                else {
                    // test performance is ok
                }
            }
            else {
                // since there's no data, add the average result to the base JSON
                testsWereAdded = true;
                var newTest = {
                    name: result.name,
                    time: avg
                };
                baseJson.push(newTest);
            }
        });
        if (testsWereAdded) {
            fs_1["default"].writeFile('./test-results.json', JSON.stringify(baseJson, null, 2), function (writeResultsError) {
                if (writeResultsError) {
                    throw writeResultsError;
                }
                // tslint:disable-next-line: no-console
                console.log('The file was saved!');
            });
        }
    });
});
