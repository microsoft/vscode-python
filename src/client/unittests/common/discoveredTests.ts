// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Uri } from 'vscode';
import {
    TestFile, TestFunction, TestSuite
} from './types';

/**
 * Data structure that the testing_tools adapter returns during test discovery.
 * See `/pythonFiles/testing_tools/run_adapter.py` for details.
 */
export type DiscoveredTestData = {
    id: string; // id of the test itself, used to run the test individually
    lineno: number; // the line number the test exists on
    markers?: string[]; // any markers (or 'decorators' that have been applied to the test, such as `skip` or `skipIf`), optional.
    name: string; // the name of the test function
    relfile: string; // the file the test exists in, relative to the test root
    subtest?: string[]; // if the test is a parameterized test, this is the set of parameters, optional.
    testfunc: string; // the test function part of the id - pattern is '[test_suite_name.[test_sub_suite_name.]*]test_function_name'
    testroot: string; // the root that was searched when this test function was discovered
};

/**
 * DiscoveredTest class
 *
 * Wrapper for the `DiscoveredTestData` type received from the testing_tools adapter module.
 * Provides tools to transform the results of test discovery from the Python adapter module into
 * the current `TestFile` struct (and its peers).
 */
export class DiscoveredTest {
    constructor(private data: DiscoveredTestData) { }

    // Expose the fileds of the DiscoveredTestData for convenience
    public get id(): string { return this.data.id; }
    public get lineno(): number { return this.data.lineno; }
    public get markers(): string[] { return this.data.markers; }
    public get name(): string { return this.data.name; }
    public get relfile(): string { return this.data.relfile; }
    public get subtest(): string[] { return this.data.subtest; }
    public get testfunc(): string { return this.data.testfunc; }
    public get testroot(): string { return this.data.testroot; }

    /**
     * Convert this test function to the TestSuite hierarchy that it is contained in, filling
     * in all fields of each suite and sub-suite required by the extension.
     *
     * @param from The DiscoveredTest to convert into a `TestSuite`.
     * @returns `TestSuite` containing the function (and any sub-suites), or if this function
     *                      is not contained in a test suite, returns undefined
     */
    public static toTestSuite(from: DiscoveredTest): TestSuite {
        const suiteNames = from.testfunc.split('.');
        suiteNames.pop(); // remove the function leaving only the suites.
        let resultSuites: TestSuite;
        let currentSuite: TestSuite[];

        while (suiteNames.length > 0) {
            const suiteName = suiteNames.pop();
            const normalized = path.normalize(from.relfile).replace(/\\/g, '/');
            const nameToRun = [normalized, ...suiteNames, suiteName].join('::');
            const xmlName = [from.toFileXmlName(), ...suiteNames, suiteName].join('.');
            const suiteToAdd: TestSuite = {
                //file: this.relfile,
                functions: [],
                isUnitTest: true,
                isInstance: false,
                name: suiteName,
                nameToRun,
                resource: Uri.file(from.testroot),
                //status: TestStatus.Idle,
                suites: [],
                time: 0,
                xmlName
            };

            if (suiteNames.length <= 0) {
                // this is the last suite, push the function into it
                suiteToAdd.functions.push(DiscoveredTest.toTestFunction(from));
            }

            if (resultSuites === undefined) {
                // the first time around, set the top-level suite in the hierarchy
                resultSuites = suiteToAdd;
                currentSuite = resultSuites.suites;
            } else {
                // the subsequent iterations, set the next-sub-suite into the hierarchy
                currentSuite.push(suiteToAdd);
                currentSuite = suiteToAdd.suites;
            }
        }

        return resultSuites;
    }

    /**
     * Convert discovered test function to the TestFunction format, filling in all the
     * necessary fields for the extension to use elsewhere.
     *
     * @param from The DiscoveredTest to convert into a `TestFunction`.
     * @returns this test function in `TestFunction` form.
     */
    public static toTestFunction(from: DiscoveredTest): TestFunction {
        return {
            //file: this.relfile,
            //line: this.lineno,
            name: from.name,
            nameToRun: from.id,
            resource: Uri.file(from.testroot),
            //status: TestStatus.Idle,
            time: 0
        };
    }

    /**
     * Convert this test function to the `TestFile` that contains it, filling in
     * the suites and sub-suites hierarchy as well. Fill in only those fields required
     * for the rest of the extension.
     *
     * @param from The DiscoveredTest to convert into a `TestFile`.
     * @returns This discovered test function as a `TestFile` with the suite hierarchy in place.
     */
    public static toTestFile(from: DiscoveredTest): TestFile {
        const fullPath = path.join(from.testroot, from.relfile);
        // if this function is in a suite, set up the suite hierarchy
        const suites: TestSuite[] = from.isInSuite ? [DiscoveredTest.toTestSuite(from)] : [];
        // otherwise if this is a bare function in the file, just add this function directly to the file.
        const functions: TestFunction[] = from.isInSuite ? [] : [DiscoveredTest.toTestFunction(from)];
        // test file name is also the name to run.
        const name = from.getTestFileName();

        return {
            fullPath,
            functions,
            name,
            nameToRun: name,
            resource: Uri.file(from.testroot),
            //status: TestStatus.Idle,
            suites,
            time: 0,
            xmlName: from.toFileXmlName()
        };
    }

    /**
     * Merge this test function into a list of already found test suites, in the approprate place in the
     * hierarchy.
     *
     * @param from The DiscoveredTest to add to a list of `TestSuite`.
     * @param testSuites The current test suites in the hierarchy to find where this test function belongs
     * @returns `true` if the given `from` is a test suite (and is added to the test suites list, or one of
     *          the subordinate test suite's lists). `false` if the given `from` is not a test within a suite.
     */
    public static addToSuite(from: DiscoveredTest, testSuites: TestSuite[]): boolean {
        let mySuite = DiscoveredTest.toTestSuite(from);

        // ensure we are in a suite first, exit otherwise
        if (mySuite === undefined) {
            return false;
        }

        // begin walking recursively through the testSuites hierarchy as this function's suites match
        let childSuites = testSuites;
        let owningSuite = childSuites.find((ts: TestSuite) => ts.name === mySuite.name);

        while (owningSuite !== undefined) {
            if (mySuite.suites.length <= 0) {
                // we've run out of child suites from my function - push the function into this owning suite.
                owningSuite.functions.push(...mySuite.functions);
                break;
            }

            // drop to the next level in the found owning suite's hierarchy
            childSuites = owningSuite.suites;
            // drop to the next level in this test's hierarchy
            mySuite = mySuite.suites[0];
            owningSuite = childSuites.find((ts: TestSuite) => ts.name === mySuite.name);
        }

        // if we got to the end of the owning suite's hierarchy and still have a part of this
        // function's hierarchy left, push this function's hierarchy into the childSuites.
        if (owningSuite === undefined) {
            childSuites.push(mySuite);
        }
        return true;
    }

    /**
     * Merge this test function into an already-found test file that matches this functions
     * test file.
     *
     * @param from The DiscoveredTest to merge into the given `testFile`.
     * @param testFile The test file to merge into.
     * @returns `true` if the given `from` test exists within the given `testFile`, `false otherwise.
     */
    public static addToFile(from: DiscoveredTest, testFile: TestFile): boolean {
        // quick test to ensure this test function actually belongs in this file...
        if (from.getTestFileName() !== testFile.name) {
            return false;
        }

        if (!DiscoveredTest.addToSuite(from, testFile.suites)) {
            // this function is not in a suite hierarchy, push it into the direct functions of this file
            testFile.functions.push(DiscoveredTest.toTestFunction(from));
        }
        return true;
    }

    /**
     * Is this test owned by a suite?
     *
     * @returns true if this function is part of a suite.
     */
    public get isInSuite(): boolean {
        // if the `testfunc` is equal to the name, there is no suite.
        return !(this.testfunc === this.name);
    }

    /**
     * Function to get a test file name for use in the TestFiles struct.
     * Note: normalizes all paths with forward slashes even in Windows.
     *
     * @returns string value representing a test file relative path.
     */
    public getTestFileName(): string {
        const filePath = path.normalize(this.relfile);
        return filePath.replace(/\\/g, '/');
    }

    /**
     * Build up the xmlName for the TestFiles structure.
     *
     * This name requires the full path to the file, minus the extension of the file,
     * and with the path separator characters converted to dots.
     *
     * @returns string representing the 'xmlName' of this test function's file.
     */
    public toFileXmlName(): string {
        const pathParts = path.parse(this.getTestFileName());
        const dirParts = (pathParts.dir.split('/')).filter((v) => v.length > 0);
        let xmlName = [path.basename(this.relfile, path.extname(this.relfile))].join('.');
        if (dirParts.length > 0) {
            xmlName = [...dirParts, xmlName].join('.');
        }
        return xmlName;
    }
}
