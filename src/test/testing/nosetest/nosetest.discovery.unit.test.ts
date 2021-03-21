// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import * as fs from 'fs-extra';
import { CancellationToken, Uri } from 'vscode';
import { IServiceContainer } from '../../../client/ioc/types';
import { NOSETEST_PROVIDER } from '../../../client/testing/common/constants';
import { TestsHelper } from '../../../client/testing/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/testing/common/testVisitors/flatteningVisitor';
import {
    IArgumentsService,
    ITestDiscoveryService,
    ITestRunner,
    ITestsParser,
    Options,
    TestDiscoveryOptions,
    TestFilter,
    Tests,
    UnitTestParserOptions,
} from '../../../client/testing/common/types';
import { TestDiscoveryService } from '../../../client/testing/nosetest/services/discoveryService';
import { TestsParser } from '../../../client/testing/nosetest/services/parserService';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';

const DISCOVERY_OUTPUT = path.join(
    EXTENSION_ROOT_DIR_FOR_TESTS,
    'src',
    'test',
    'testing',
    'nosetest',
    'nose_discovery_output.txt',
);

use(chaipromise);

suite('Unit Tests - nose - Discovery', () => {
    let discoveryService: ITestDiscoveryService;
    let argsService: typeMoq.IMock<IArgumentsService>;
    let testParser: typeMoq.IMock<ITestsParser>;
    let runner: typeMoq.IMock<ITestRunner>;
    let serviceContainer: typeMoq.IMock<IServiceContainer>;

    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        argsService = typeMoq.Mock.ofType<IArgumentsService>();
        testParser = typeMoq.Mock.ofType<ITestsParser>();
        runner = typeMoq.Mock.ofType<ITestRunner>();

        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IArgumentsService), typeMoq.It.isAny()))
            .returns(() => argsService.object);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);

        discoveryService = new TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFunctions: [],
            testSuites: [],
            rootTestFolders: [],
            testFolders: [],
        };
        argsService
            .setup((a) => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--collect-only');
                expect(opts.args).to.include('-vvv');
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser
            .setup((t) => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup((o) => o.args).returns(() => args);
        options.setup((o) => o.token).returns(() => token.object);
        token.setup((t) => t.isCancellationRequested).returns(() => false);

        const result = await discoveryService.discoverTests(options.object);

        expect(result).to.be.equal(tests);
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is cancelled', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFunctions: [],
            testSuites: [],
            rootTestFolders: [],
            testFolders: [],
        };
        argsService
            .setup((a) => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--collect-only');
                expect(opts.args).to.include('-vvv');
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser
            .setup((t) => t.parse(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        token
            .setup((t) => t.isCancellationRequested)
            .returns(() => true)
            .verifiable(typeMoq.Times.once());

        options.setup((o) => o.args).returns(() => args);
        options.setup((o) => o.token).returns(() => token.object);
        const promise = discoveryService.discoverTests(options.object);

        await expect(promise).to.eventually.be.rejectedWith('cancelled');
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });

    test('Ensure discovery resolves test files in n-depth directories', async () => {
        const discoveryOutput = await fs.readFile(DISCOVERY_OUTPUT, 'utf8');
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => '/home/user/dev/tests');

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(3);
        expect(tests.testFunctions.length).to.be.equal(6);
        expect(tests.testSuites.length).to.be.equal(3);
        expect(tests.testFolders.length).to.be.equal(5);

        // now ensure that the 'nameToRun' for each test function begins with its file's a single test suite...
        tests.testFunctions.forEach((fn) => {
            if (fn.parentTestSuite) {
                const testPrefix: boolean = fn.testFunction.nameToRun.startsWith(fn.parentTestFile.nameToRun);
                expect(testPrefix).to.equal(
                    true,
                    [
                        `function ${fn.testFunction.name} was found in file ${fn.parentTestFile.name}, `,
                        `but the parent file 'nameToRun' (${fn.parentTestFile.nameToRun}) isn't the `,
                        `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`,
                    ].join(''),
                );
            }
        });

        // Check we didn't report the unittest TestCase base class as a suite
        tests.testSuites.forEach((suite) => {
            expect(suite.testSuite.name).to.not.equal(
                'unittest.case.TestCase',
                'unittest.case.TestCase found in discovered tests',
            );
            expect(suite.testSuite.functions.length).to.be.greaterThan(
                0,
                `${suite.testSuite.name} has no runnable tests`,
            );
        });
    });
});
