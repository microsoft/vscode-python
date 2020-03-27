// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import {
    ITestsHelper,
    ITestsParser,
    TestFile,
    TestFunction,
    Tests,
    TestStatus,
    UnitTestParserOptions,
} from '../../common/types';

@injectable()
export class TestsParser implements ITestsParser {
    constructor(@inject(ITestsHelper) private testsHelper: ITestsHelper) {}
    public parse(content: string, options: UnitTestParserOptions): Tests {
        const testIds = this.getTestIds(content);
        let testsDirectory = options.cwd;
        if (options.startDirectory.length > 1) {
            testsDirectory = path.isAbsolute(options.startDirectory)
                ? options.startDirectory
                : path.resolve(options.cwd, options.startDirectory);
        }
        return this.parseTestIds(options.cwd, testsDirectory, testIds);
    }
    private getTestIds(content: string): string[] {
        let startedCollecting = false;
        return content
            .split(/\r?\n/g)
            .map((line) => {
                if (!startedCollecting) {
                    if (line === 'start') {
                        startedCollecting = true;
                    }
                    return '';
                }
                return line.trim();
            })
            .filter((line) => line.length > 0);
    }
    private parseTestIds(workspaceDirectory: string, testsDirectory: string, testIds: string[]): Tests {
        const testFiles: TestFile[] = [];
        testIds.forEach((testId) => this.addTestId(testsDirectory, testId, testFiles));

        return this.testsHelper.flattenTestFiles(testFiles, workspaceDirectory);
    }

    /**
     * Add the test Ids into the array provided.
     * TestIds are fully qualified including the method names.
     * E.g. tone_test.Failing2Tests.test_failure
     * Where tone_test = folder, Failing2Tests = class/suite, test_failure = method.
     * @private
     * @param {string} rootDirectory
     * @param {string[]} testIds
     * @returns {Tests}
     * @memberof TestsParser
     */
    private addTestId(rootDirectory: string, testId: string, testFiles: TestFile[]) {
        const testIdParts = testId.split('.');
        // We must have a file, class and function name
        if (testIdParts.length <= 2) {
            return null;
        }

        const paths = testIdParts.slice(0, testIdParts.length - 2);
        const filePath = `${path.join(rootDirectory, ...paths)}.py`;
        const functionName = testIdParts.pop()!;
        const suiteToRun = testIdParts.join('.');
        const className = testIdParts.pop()!;
        const moduleName = testIdParts.join('.');
        const resource = Uri.file(rootDirectory);

        // Check if we already have this test file
        let testFile = testFiles.find((test) => test.fullPath === filePath);
        if (!testFile) {
            testFile = {
                resource,
                name: path.basename(filePath),
                fullPath: filePath,
                functions: [],
                suites: [],
                nameToRun: moduleName,
                xmlName: '',
                status: TestStatus.Idle,
                time: 0,
            };
            testFiles.push(testFile);
        }

        // Check if we already have this suite
        // nameToRun = testId - method name
        let testSuite = testFile.suites.find((cls) => cls.nameToRun === suiteToRun);
        if (!testSuite) {
            testSuite = {
                resource,
                name: className,
                functions: [],
                suites: [],
                isUnitTest: true,
                isInstance: false,
                nameToRun: suiteToRun,
                xmlName: '',
                status: TestStatus.Idle,
                time: 0,
            };
            testFile.suites.push(testSuite!);
        }

        const testFunction: TestFunction = {
            resource,
            name: functionName,
            nameToRun: testId,
            status: TestStatus.Idle,
            time: 0,
        };

        testSuite!.functions.push(testFunction);
    }
}
