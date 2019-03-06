// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import {
    TestFile, TestFunction, TestStatus, TestSuite
} from './types';

export type DiscoveredTestData = {
    id: string;
    lineno: number;
    markers?: string[];
    name: string;
    relfile: string;
    subtest?: string[];
    testfunc: string;
    testroot: string;
};

export class DiscoveredTest {
    constructor(private readonly data: DiscoveredTestData) { }

    public get id(): string { return this.data.id; }
    public get lineno(): number { return this.data.lineno; }
    public get markers(): string[] { return this.data.markers; }
    public get name(): string { return this.data.name; }
    public get relfile(): string { return this.data.relfile; }
    public get subtest(): string[] { return this.data.subtest; }
    public get testfunc(): string { return this.data.testfunc; }
    public get testroot(): string { return this.data.testroot; }

    public toTestSuite(): TestSuite {
        const suiteNames = this.testfunc.split('.');
        suiteNames.pop(); // remove the function leaving only the suites.
        let resultSuites: TestSuite;
        let currentSuite: TestSuite[];

        while (suiteNames.length > 0) {
            const suiteName = suiteNames.pop();
            const suiteId = [path.join(this.testroot, this.relfile), ...suiteNames, suiteName];
            const suiteToAdd: TestSuite = {
                isInstance: true,
                functions: [],
                isUnitTest: false,
                name: suiteName,
                nameToRun: suiteId.join('::'),
                suites: [],
                time: Date.now(),
                xmlName: suiteId.join(':')
            };
            if (suiteNames.length <= 0) {
                // this is the last suite, push the function into it
                suiteToAdd.functions.push(this.toTestFunction());
            }

            if (resultSuites === undefined) {
                resultSuites = suiteToAdd;
                currentSuite = resultSuites.suites;
            } else {
                currentSuite.push(suiteToAdd);
                currentSuite = suiteToAdd.suites;
            }
        }

        return resultSuites;
    }

    public toTestFunction(): TestFunction {
        return {
            name: this.name,
            nameToRun: this.id,
            time: Date.now(),
            status: TestStatus.Unknown,
            line: this.lineno,
            file: this.relfile
        };
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

    public toTestFile(): TestFile {
        const fullpath = path.join(this.testroot, this.relfile);
        const suites: TestSuite[] = this.isInSuite ? [this.toTestSuite()] : [];
        const functions: TestFunction[] = this.isInSuite ? [] : [this.toTestFunction()];

        return {
            fullPath: fullpath,
            functions,
            name: this.relfile,
            nameToRun: this.relfile,
            suites,
            time: Date.now(),
            xmlName: this.relfile
        };
    }

    public addToSuite(testSuites: TestSuite[]): void {
        let mySuite = this.toTestSuite();
        let childSuites = testSuites;
        let owningSuite = childSuites.find((ts: TestSuite) => ts.name === mySuite.name);
        while (owningSuite !== undefined) {
            if (mySuite.suites.length <= 0) {
                // we've run out of child suites from my funciton - push the function into this owning suite.
                owningSuite.functions.push(...mySuite.functions);
                break;
            }
            childSuites = owningSuite.suites;
            mySuite = mySuite.suites[0];
            owningSuite = childSuites.find((ts: TestSuite) => ts.name === mySuite.name);
        }
        if (owningSuite === undefined) {
            childSuites.push(mySuite);
        }
    }

    public addToFile(testFile: TestFile): void {
        if (this.isInSuite) {
            this.addToSuite(testFile.suites);
        } else {
            testFile.functions.push(this.toTestFunction());
        }
    }
}
