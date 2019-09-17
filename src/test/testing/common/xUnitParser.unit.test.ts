// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

'use strict';

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { IFileSystem } from '../../../client/common/platform/types';
import {
    IXUnitParser, PassCalculationFormulae, Tests, TestStatus
} from '../../../client/testing/common/types';
import { XUnitParser } from '../../../client/testing/common/xUnitParser';
import { createResults } from '../helpers-declarative';
import { TestItem } from '../helpers-nodes';
import { createEmptyResults } from '../helpers-results';

suite('Testing - parse JUnit XML file', () => {
    let parser: IXUnitParser;
    let fs: typeMoq.IMock<IFileSystem>;
    setup(() => {
        fs = typeMoq.Mock.ofType<IFileSystem>(undefined, typeMoq.MockBehavior.Strict);
        parser = new XUnitParser(fs.object);
    });

    function fixResult(node: TestItem, file: string, line: number) {
        switch (node.status) {
            case TestStatus.Pass:
                node.passed = true;
                break;
            case TestStatus.Fail:
            case TestStatus.Error:
                node.passed = false;
                break;
            default:
                node.passed = undefined;
        }
        node.file = file;
        node.line = line;
    }

    test('success with single passing test', async () => {
        const tests = createResults(`
            ./
                test_spam.py
                    <Tests>
                        test_spam
            `);
        const expected = createResults(`
            ./
                test_spam.py
                    <Tests>
                        test_spam P 1.001
            `);
        fixResult(
            expected.testFunctions[0].testFunction,
            'test_spam.py',
            3
        );
        const filename = 'x/y/z/results.xml';
        fs.setup(f => f.readFile(filename))
            .returns(() => Promise.resolve(`
                <?xml version="1.0" encoding="utf-8"?>
                <testsuite errors="0" failures="0" hostname="linux-desktop" name="pytest" skipped="0" tests="1" time="1.011" timestamp="2019-08-29T15:59:08.757654">
                    <testcase classname="test_spam.Tests" file="test_spam.py" line="3" name="test_spam" time="1.001">
                    </testcase>
                </testsuite>
            `));

        await parser.updateResultsFromXmlLogFile(
            tests,
            filename,
            PassCalculationFormulae.pytest
        );

        expect(tests).to.deep.equal(expected);
        fs.verifyAll();
    });

    test('no discovered tests', async () => {
        const tests: Tests = createEmptyResults();
        const expected: Tests = createEmptyResults();
        expected.summary.passed = 1;  // That's a little strange...
        const filename = 'x/y/z/results.xml';
        fs.setup(f => f.readFile(filename))
            .returns(() => Promise.resolve(`
                <?xml version="1.0" encoding="utf-8"?>
                <testsuite errors="0" failures="0" hostname="linux-desktop" name="pytest" skipped="0" tests="1" time="0.011" timestamp="2019-08-29T15:59:08.757654">
                    <testcase classname="test_spam.Tests" file="test_spam.py" line="3" name="test_spam" time="0.001">
                    </testcase>
                </testsuite>
            `));

        await parser.updateResultsFromXmlLogFile(
            tests,
            filename,
            PassCalculationFormulae.pytest
        );

        expect(tests).to.deep.equal(expected);
        fs.verifyAll();
    });

    test('no tests run', async () => {
        const tests: Tests = createEmptyResults();
        const expected: Tests = createEmptyResults();
        const filename = 'x/y/z/results.xml';
        fs.setup(f => f.readFile(filename))
            .returns(() => Promise.resolve(`
                <?xml version="1.0" encoding="utf-8"?>
                <testsuite errors="0" failures="0" hostname="linux-desktop" name="pytest" skipped="0" tests="0" time="0.011" timestamp="2019-08-29T15:59:08.757654">
                </testsuite>
            `));

        await parser.updateResultsFromXmlLogFile(
            tests,
            filename,
            PassCalculationFormulae.pytest
        );

        expect(tests).to.deep.equal(expected);
        fs.verifyAll();
    });

    // Missing tests (see gh-7447):
    // * simple pytest
    // * simple nose
    // * complex
    // * error
    // * failure
    // * skipped
    // * no clobber old if not matching
    // * ...
});
