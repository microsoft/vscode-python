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

    /**
     * Parse the results of running test discovery and translate them to the `Tests` structure.
     *
     * For more information on how we get parsed data, see `pythonFiles/testing_tools/run_adapter.py`.
     *
     * @param content String content received from the testing_tools Python adapter, expected to be valid JSON
     * @param options Runtime options to send to `pytest`, relayed to the adapter.
     * @returns Filled out `Tests` struct.
     * @throws Error if invalid JSON is recieved from the Python adapter.
     */
    public parse(content: string, options: ParserOptions): Tests {
        // check that there is something to parse...
        if (content === undefined || content.length <= 0 || content.trim().length <= 0) {
            return undefined;
        }

        let testsDiscovered: DiscoveredTestData[];
        try {
            testsDiscovered = JSON.parse(content);
        } catch (ex) {
            throw new Error(`Could not discover tests, ensure your pytest settings are correct. Further details:\n${ex}`);
        }

        // build our array of tests in a map to make discovery a bit easier:
        const testsParsed: Map<string, TestFile> = new Map<string, TestFile>();
        // for each discovered test, either add it or merge it to existing test files:
        testsDiscovered.forEach((testFn: DiscoveredTestData) => {
            const dt: DiscoveredTest = new DiscoveredTest(testFn);
            const tstFile: TestFile = testsParsed.get(dt.relfile);
            if (tstFile !== undefined) {
                // we've already encountered this test file, merge this function into it
                DiscoveredTest.addToFile(dt, tstFile);
            } else {
                testsParsed.set(dt.relfile, DiscoveredTest.toTestFile(dt));
            }
        });

        // pull all the values out of the map into the expected array:
        const testFiles: TestFile[] = [];
        testsParsed.forEach((testFile: TestFile, relfile: string) => {
            testFiles.push(testFile);
        });

        // Build the `Tests` struct out of the list of files
        return this.testsHelper.flattenTestFiles(testFiles, options.cwd);
    }
}
