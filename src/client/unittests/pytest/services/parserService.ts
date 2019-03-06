// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import '../../../common/extensions';
import {
    DiscoveredTest, DiscoveredTestData
} from '../../common/discoveredTests';
import {
    ITestsHelper, ITestsParser, ParserOptions,
    TestFile, Tests
} from '../../common/types';

@injectable()
export class TestsParser implements ITestsParser {

    constructor(@inject(ITestsHelper) private testsHelper: ITestsHelper) { }

    public parse(content: string, options: ParserOptions): Tests {
        const testsDiscovered: DiscoveredTestData[] = JSON.parse(content);
        const testsParsed: Map<string, TestFile> = new Map<string, TestFile>();
        testsDiscovered.forEach((testFn: DiscoveredTestData) => {
            const dt: DiscoveredTest = new DiscoveredTest(testFn);
            const tstFile: TestFile = testsParsed.get(dt.relfile);
            if (tstFile !== undefined) {
                dt.addToFile(tstFile);
            } else {
                testsParsed.set(dt.relfile, dt.toTestFile());
            }
        });

        const testFiles: TestFile[] = [];
        testsParsed.forEach((testFile: TestFile, relfile: string) => {
            testFiles.push(testFile);
        });

        return this.testsHelper.flattenTestFiles(testFiles, options.cwd);
    }
}
