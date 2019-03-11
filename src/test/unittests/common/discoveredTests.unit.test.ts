// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import {
    DiscoveredTest, DiscoveredTestData
} from '../../../client/unittests/common/discoveredTests';
import { TestFunction, TestSuite } from '../../../client/unittests/common/types';

use(chaipromise);

// tslint:disable-next-line:max-func-body-length
suite('Test discovery API parser and transformer', () => {
    const testFolder = 'tests';
    const testFileBase = 'test_file';
    const testSuite = 'TestSuite';
    const testFunction = 'test_function';

    function createDiscoveredTestData(
        folderName: string = testFolder,
        fileNameBase: string = testFileBase,
        suiteName: string = testSuite,
        functionName: string = testFunction,
        windowsEnv: boolean = false
    ): DiscoveredTestData {
        const tdata_nonWin: DiscoveredTestData = {
            id: `${folderName}/${fileNameBase}.py::${suiteName}::${functionName}`,
            lineno: 12,
            markers: undefined,
            name: functionName,
            relfile: `./${folderName}/${fileNameBase}.py`,
            subtest: undefined,
            testfunc: `${suiteName}.${functionName}`,
            testroot: '/home/user/dev'
        };

        const tdata_win: DiscoveredTestData = {
            id: `${folderName}/${fileNameBase}.py::${suiteName}::${functionName}`,
            lineno: 12,
            markers: undefined,
            name: functionName,
            relfile: `.\\${folderName}\\${fileNameBase}.py`,
            subtest: undefined,
            testfunc: `${suiteName}.${functionName}`,
            testroot: 'C:\\Users\\user\\Documents\\dev'
        };

        return windowsEnv ? tdata_win : tdata_nonWin;
    }

    test('DiscoveredTest created for valid DiscoveredTestData', () => {
        const discTest: DiscoveredTest = new DiscoveredTest(createDiscoveredTestData());
        expect(discTest).to.not.equal(undefined, 'Unable to construct a DiscoveredTest with valid test data.');
    });

    test('Discovered test identifies as part of a suite properly.', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        expect(discTest.isInSuite).to.equal(true, 'Test discovered as part of a suite is not reporting it to be part of a suite.');
        testData.testfunc = testData.name; // make the function exist outside of a suite
        expect(discTest.isInSuite).to.equal(false, 'Test discovered as part of no suite is reporting it to be part of a suite.');
    });

    test('Discovered test file name is normalized as expected', () => {
        const discTestWin = new DiscoveredTest(createDiscoveredTestData(undefined, undefined, undefined, undefined, true));
        const discTest = new DiscoveredTest(createDiscoveredTestData());
        expect(discTestWin.getTestFileName()).to.be.equal(discTest.getTestFileName());
    });

    test('Discovered test file xmlName is formatted properly and has all necessary fields', () => {
        // test the default, single-sub-folder tests provided
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        let xmlName = discTest.toFileXmlName();
        expect(xmlName).to.be.equal(`${testFolder}.${testFileBase}`);

        // test file found at the root folder:
        testData.id = `${testFileBase}.py::${testSuite}::${testFunction}`;
        testData.relfile = `./${testFileBase}.py`;
        xmlName = discTest.toFileXmlName();
        expect(xmlName).to.be.equal(testFileBase);

        // test file found one folder deeper:
        const subFolder = 'sub';
        testData.id = `${testFolder}/${subFolder}/${testFileBase}.py::${testSuite}::${testFunction}`;
        testData.relfile = `./${testFolder}/${subFolder}/${testFileBase}.py`;
        xmlName = discTest.toFileXmlName();
        expect(xmlName).to.be.equal(`${testFolder}.${subFolder}.${testFileBase}`);
    });

    test('Discovered test produces a valid TestFunction', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        const testFn = DiscoveredTest.toTestFunction(discTest);

        expect(testFn.name).to.be.equal(testFunction);
        expect(testFn.nameToRun).to.be.equal(`${testFolder}/${testFileBase}.py::${testSuite}::${testFunction}`);
        expect(testFn.time).to.be.equal(0);
    });

    test('Discovered test produces a valid TestSuite', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        const suite = DiscoveredTest.toTestSuite(discTest);
        expect(suite.name).to.be.equal(testSuite);
        expect(suite.nameToRun).to.be.equal(`${testFolder}/${testFileBase}.py::${testSuite}`);
        expect(suite.isInstance).to.be.equal(false, 'isInstance field should be false.');
        expect(suite.isUnitTest).to.be.equal(true, 'isUnitTest should be true for unittest based test class functions');
        expect(suite.suites.length).to.be.equal(0);
        expect(suite.xmlName).to.be.equal(`${testFolder}.${testFileBase}.${testSuite}`);

        expect(suite.functions.length).to.be.equal(1);
        expect(suite.functions[0].name).to.be.equal(testFunction);
    });

    test('Discovered test produces a valid TestFile', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        const testFile = DiscoveredTest.toTestFile(discTest);
        expect(testFile.name).to.be.equal(`${testFolder}/${testFileBase}.py`, 'File name does not match the correct file name.');
        expect(testFile.nameToRun).to.be.equal(`${testFolder}/${testFileBase}.py`, 'Name to run does not match the correct pattern.');
        expect(testFile.xmlName).to.be.equal(`${testFolder}.${testFileBase}`, 'xmlName does not include folder and file base name.');

        expect(testFile.suites.length).to.be.equal(1);
        expect(testFile.suites[0].name).to.be.equal(testSuite);
    });

    test('Merging a function into a file is correct', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        const testFile = DiscoveredTest.toTestFile(discTest);

        // create a second test function in this same file
        const testData2 = createDiscoveredTestData(undefined, undefined, 'TestSuite2', 'test_function_two');
        const discTest2 = new DiscoveredTest(testData2);

        const resultOfMerge = DiscoveredTest.addToFile(discTest2, testFile);
        expect(resultOfMerge).to.be.equal(true, 'Could not successfully merge two test functions in the same file/suite.');

        expect(testFile.suites.length).to.be.equal(2, 'The merged test file should contain two distinct suites.');
        expect(testFile.suites[0].functions.length).to.be.equal(1, 'Each suite should contain a single test function.');
        expect(testFile.suites[1].functions.length).to.be.equal(1, 'Each suite should contain a single test function.');
        testFile.suites.forEach((tf: TestSuite) => {
            expect([testSuite, 'TestSuite2']).to.contain(tf.name, 'Each test suite should be accounted for.');
        });
    });

    test('Merging a suite into another suite is correct', () => {
        const testData = createDiscoveredTestData();
        const discTest = new DiscoveredTest(testData);
        const testFile = DiscoveredTest.toTestFile(discTest);

        // create a second test function in this same file
        const testData2 = createDiscoveredTestData(undefined, undefined, undefined, 'test_function_two');
        const discTest2 = new DiscoveredTest(testData2);

        const resultOfMerge = DiscoveredTest.addToSuite(discTest2, testFile.suites);
        expect(resultOfMerge).to.be.equal(true, 'Could not successfully merge two test functions into the same suite.');

        expect(testFile.suites.length).to.be.equal(1);
        expect(testFile.suites[0].functions.length).to.be.equal(2);
        testFile.suites[0].functions.forEach((tf: TestFunction) => {
            expect([testFunction, 'test_function_two']).to.contain(tf.name);
        });
    });
});
