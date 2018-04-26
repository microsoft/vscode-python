// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ITestsHelper, ITestsParser, TestDiscoveryOptions, TestFile, TestFunction, Tests, TestStatus, TestSuite } from '../../common/types';

type UnitTestParserOptions = TestDiscoveryOptions & { startDirectory: string };

@injectable()
export class TestsParser implements ITestsParser {
    constructor(@inject(ITestsHelper) private testsHelper: ITestsHelper) { }
    public parse(content: string, options: UnitTestParserOptions): Tests {
        const testIds = this.getTestIds(content);
        let testsDirectory = options.cwd;
        if (options.startDirectory.length > 1) {
            testsDirectory = path.isAbsolute(options.startDirectory) ? options.startDirectory : path.resolve(options.cwd, options.startDirectory);
        }
        return this.parseTestIds(testsDirectory, testIds);
    }
    private getTestIds(content: string): string[] {
        let startedCollecting = false;
        return content.split(/\r?\n/g)
            .map((line, index) => {
                if (!startedCollecting) {
                    if (line === 'start') {
                        startedCollecting = true;
                    }
                    return '';
                }
                return line.trim();
            })
            .filter(line => line.length > 0);
    }
    private parseTestIds(rootDirectory: string, testIds: string[]): Tests {
        const testFiles: TestFile[] = [];
        testIds.forEach(testId => {
            this.addTestId(rootDirectory, testId, testFiles);
        });

        return this.testsHelper.flattenTestFiles(testFiles);
    }

    private addTestId(rootDirectory: string, testId: string, testFiles: TestFile[]) {
        const testIdParts = testId.split('.');
        // We must have a file, class and function name
        if (testIdParts.length <= 2) {
            return null;
        }

        const paths = testIdParts.slice(0, testIdParts.length - 2);
        const filePath = `${path.join(rootDirectory, ...paths)}.py`;
        const functionName = testIdParts.pop()!;
        const className = testIdParts.pop()!;

        // Check if we already have this test file
        let testFile = testFiles.find(test => test.fullPath === filePath);
        if (!testFile) {
            testFile = {
                name: path.basename(filePath),
                fullPath: filePath,
                // tslint:disable-next-line:prefer-type-cast
                functions: [] as TestFunction[],
                // tslint:disable-next-line:prefer-type-cast
                suites: [] as TestSuite[],
                nameToRun: `${className}.${functionName}`,
                xmlName: '',
                status: TestStatus.Idle,
                time: 0
            };
            testFiles.push(testFile);
        }

        // Check if we already have this test file
        const classNameToRun = className;
        let testSuite = testFile.suites.find(cls => cls.nameToRun === classNameToRun);
        if (!testSuite) {
            testSuite = {
                name: className,
                // tslint:disable-next-line:prefer-type-cast
                functions: [] as TestFunction[],
                // tslint:disable-next-line:prefer-type-cast
                suites: [] as TestSuite[],
                isUnitTest: true,
                isInstance: false,
                nameToRun: `${path.parse(filePath).name}.${classNameToRun}`,
                xmlName: '',
                status: TestStatus.Idle,
                time: 0
            };
            testFile.suites.push(testSuite!);
        }

        const testFunction: TestFunction = {
            name: functionName,
            nameToRun: testId,
            status: TestStatus.Idle,
            time: 0
        };

        testSuite!.functions.push(testFunction);
    }
}
