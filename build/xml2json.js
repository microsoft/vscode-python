// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var fast_xml_parser_1 = __importDefault(require("fast-xml-parser"));
var fs_1 = __importDefault(require("fs"));
var TestBenchmark = /** @class */ (function () {
    function TestBenchmark() {
    }
    return TestBenchmark;
}());
exports.TestBenchmark = TestBenchmark;
var xmlFile = '../test-results.xml';
fs_1["default"].readFile(xmlFile, 'utf8', function (err, data) {
    if (err) {
        throw err;
    }
    var JsonOutput = [];
    if (fast_xml_parser_1["default"].validate(data)) {
        var defaultOptions = {
            attributeNamePrefix: '',
            ignoreAttributes: false
        };
        var jsonObj = fast_xml_parser_1["default"].parse(data, defaultOptions);
        jsonObj.testsuites.testsuite.forEach(function (suite) {
            if (parseInt(suite.tests, 10) > 0) {
                if (Array.isArray(suite.testcase)) {
                    suite.testcase.forEach(function (testcase) {
                        var test = {
                            name: testcase.name,
                            time: parseFloat(testcase.time)
                        };
                        JsonOutput.push(test);
                    });
                }
                else {
                    var test_1 = {
                        name: suite.testcase.name,
                        time: parseFloat(suite.testcase.time)
                    };
                    JsonOutput.push(test_1);
                }
            }
        });
    }
    fs_1["default"].writeFile('./test-results.json', JSON.stringify(JsonOutput, null, 2), function (writeResultsError) {
        if (writeResultsError) {
            throw writeResultsError;
        }
        // tslint:disable-next-line: no-console
        console.log('The file was saved!');
    });
});
