// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var fast_xml_parser_1 = __importDefault(require("fast-xml-parser"));
var fs_1 = __importDefault(require("fs"));
var PerformanceResults = /** @class */ (function () {
    function PerformanceResults() {
    }
    return PerformanceResults;
}());
exports.PerformanceResults = PerformanceResults;
var xmlFile = '../test-results.xml';
var jsonFile = './performance-results.json';
var jsonData = [];
fs_1["default"].readFile(xmlFile, 'utf8', function (xmlReadError, xmlData) {
    if (xmlReadError) {
        throw xmlReadError;
    }
    if (fast_xml_parser_1["default"].validate(xmlData)) {
        var defaultOptions = {
            attributeNamePrefix: '',
            ignoreAttributes: false
        };
        var jsonObj_1 = fast_xml_parser_1["default"].parse(xmlData, defaultOptions);
        fs_1["default"].readFile(jsonFile, 'utf8', function (jsonReadError, data) {
            if (jsonReadError) {
                // File doesn't exist, so we create it
                jsonObj_1.testsuites.testsuite.forEach(function (suite) {
                    if (parseInt(suite.tests, 10) > 0) {
                        if (Array.isArray(suite.testcase)) {
                            suite.testcase.forEach(function (testcase) {
                                var test = {
                                    name: testcase.name,
                                    times: [testcase.time]
                                };
                                jsonData.push(test);
                            });
                        }
                        else {
                            var test_1 = {
                                name: suite.testcase.name,
                                times: [suite.testcase.time]
                            };
                            jsonData.push(test_1);
                        }
                    }
                });
            }
            else {
                jsonData = JSON.parse(data);
                jsonObj_1.testsuites.testsuite.forEach(function (suite) {
                    if (parseInt(suite.tests, 10) > 0) {
                        if (Array.isArray(suite.testcase)) {
                            suite.testcase.forEach(function (testcase) {
                                var test = jsonData.find(function (x) { return x.name === testcase.name; });
                                if (test) {
                                    // if the test name is already there, we add the new time
                                    test.times.push(parseFloat(testcase.time));
                                }
                                else {
                                    // if its not there, we add the whole thing
                                    test = {
                                        name: testcase.name,
                                        times: [parseFloat(testcase.time)]
                                    };
                                    jsonData.push(test);
                                }
                            });
                        }
                        else {
                            var test_2 = jsonData.find(function (x) { return x.name === suite.testcase.name; });
                            if (test_2) {
                                // if the test name is already there, we add the new time
                                test_2.times.push(parseFloat(suite.testcase.time));
                            }
                            else {
                                // if its not there, we add the whole thing
                                test_2 = {
                                    name: suite.testcase.name,
                                    times: [parseFloat(suite.testcase.time)]
                                };
                                jsonData.push(test_2);
                            }
                        }
                    }
                });
            }
        });
    }
    fs_1["default"].writeFile('./performance-results.json', JSON.stringify(jsonData, null, 2), function (writeResultsError) {
        if (writeResultsError) {
            throw writeResultsError;
        }
        // tslint:disable-next-line: no-console
        console.log('The file was saved!');
    });
});
