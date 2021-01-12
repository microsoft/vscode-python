// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { CancellationToken, Uri } from 'vscode';
import { IServiceContainer } from '../../../client/ioc/types';
import { UNITTEST_PROVIDER } from '../../../client/testing/common/constants';
import { TestsHelper } from '../../../client/testing/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/testing/common/testVisitors/flatteningVisitor';
import {
    ITestDiscoveryService,
    ITestRunner,
    ITestsParser,
    Options,
    TestDiscoveryOptions,
    Tests,
    UnitTestParserOptions,
} from '../../../client/testing/common/types';
import { IArgumentsHelper } from '../../../client/testing/types';
import { TestDiscoveryService } from '../../../client/testing/unittest/services/discoveryService';
import { TestsParser } from '../../../client/testing/unittest/services/parserService';

use(chaipromise);

suite('Unit Tests - Unittest - Discovery', () => {
    let discoveryService: ITestDiscoveryService;
    let argsHelper: typeMoq.IMock<IArgumentsHelper>;
    let testParser: typeMoq.IMock<ITestsParser>;
    let runner: typeMoq.IMock<ITestRunner>;
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    const dir = path.join('a', 'b', 'c');
    const pattern = 'Pattern_To_Search_For';
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        argsHelper = typeMoq.Mock.ofType<IArgumentsHelper>();
        testParser = typeMoq.Mock.ofType<ITestsParser>();
        runner = typeMoq.Mock.ofType<ITestRunner>();

        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper.object);
        serviceContainer
            .setup((s) => s.get(typeMoq.It.isValue(ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);

        discoveryService = new TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args with start directory defined with -s', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(dir);
                expect(opts.args[1]).to.not.contain('loader.discover("."');
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
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args with start directory defined with --start-directory', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(dir);
                expect(opts.args[1]).to.not.contain('loader.discover("."');
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
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a start directory', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.not.contain(dir);
                expect(opts.args[1]).to.contain('loader.discover("."');
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
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern defined with -p', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(pattern);
                expect(opts.args[1]).to.not.contain('test*.py');
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
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern defined with --pattern', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(pattern);
                expect(opts.args[1]).to.not.contain('test*.py');
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
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern not defined', async () => {
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.not.contain(pattern);
                expect(opts.args[1]).to.contain('test*.py');
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
        argsHelper.verifyAll();
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
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        argsHelper
            .setup((a) => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.atLeastOnce());
        runner
            .setup((r) => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser
            .setup((t) => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup((o) => o.args).returns(() => args);
        options.setup((o) => o.token).returns(() => token.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);

        const promise = discoveryService.discoverTests(options.object);

        await expect(promise).to.eventually.be.rejectedWith('cancelled');
        argsHelper.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery resolves test suites in n-depth directories', async () => {
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

        const discoveryOutput: string = [
            'start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            '',
        ].join('\n');

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(3);
        expect(tests.testFunctions.length).to.be.equal(6);
        expect(tests.testSuites.length).to.be.equal(3);
        expect(tests.testFolders.length).to.be.equal(5);

        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach((fn) => {
            if (fn.parentTestSuite) {
                const testPrefix: boolean = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                expect(testPrefix).to.equal(
                    true,
                    [
                        `function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                        `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                        `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`,
                    ].join(''),
                );
            }
        });
    });
    test('Ensure discovery resolves test files in n-depth directories', async () => {
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

        const discoveryOutput: string = [
            'start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            '',
        ].join('\n');

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
    });
    test('Ensure discovery resolves test suites in n-depth directories when no start directory is given', async () => {
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => '');

        const discoveryOutput: string = [
            'start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            '',
        ].join('\n');

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(3);
        expect(tests.testFunctions.length).to.be.equal(6);
        expect(tests.testSuites.length).to.be.equal(3);
        expect(tests.testFolders.length).to.be.equal(4);

        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach((fn) => {
            if (fn.parentTestSuite) {
                const testPrefix: boolean = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                expect(testPrefix).to.equal(
                    true,
                    [
                        `function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                        `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                        `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`,
                    ].join(''),
                );
            }
        });
    });
    test('Ensure discovery resolves test suites in n-depth directories when a relative start directory is given', async () => {
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => './tests');

        const discoveryOutput: string = [
            'start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            '',
        ].join('\n');

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(3);
        expect(tests.testFunctions.length).to.be.equal(6);
        expect(tests.testSuites.length).to.be.equal(3);
        expect(tests.testFolders.length).to.be.equal(5);

        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach((fn) => {
            if (fn.parentTestSuite) {
                const testPrefix: boolean = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                expect(testPrefix).to.equal(
                    true,
                    [
                        `function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                        `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                        `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`,
                    ].join(''),
                );
            }
        });
    });
    test('Ensure discovery will not fail with blank content', async () => {
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => './tests');

        const tests: Tests = testsParser.parse('', opts.object);

        expect(tests.testFiles.length).to.be.equal(0);
        expect(tests.testFunctions.length).to.be.equal(0);
        expect(tests.testSuites.length).to.be.equal(0);
        expect(tests.testFolders.length).to.be.equal(0);
    });
    test('Ensure discovery will not fail with corrupt content', async () => {
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => './tests');

        const discoveryOutput: string = [
            'a;lskdjfa',
            'allikbrilkpdbfkdfbalk;nfm',
            '',
            ';;h,spmn,nlikmslkjls.bmnl;klkjna;jdfngad,lmvnjkldfhb',
            '',
        ].join('\n');

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(0);
        expect(tests.testFunctions.length).to.be.equal(0);
        expect(tests.testSuites.length).to.be.equal(0);
        expect(tests.testFolders.length).to.be.equal(0);
    });
    test('Ensure discovery resolves when no tests are found in the given path', async () => {
        const testHelper: TestsHelper = new TestsHelper(new TestFlatteningVisitor(), serviceContainer.object);

        const testsParser: TestsParser = new TestsParser(testHelper);

        const opts = typeMoq.Mock.ofType<UnitTestParserOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        const wspace = typeMoq.Mock.ofType<Uri>();
        opts.setup((o) => o.token).returns(() => token.object);
        opts.setup((o) => o.workspaceFolder).returns(() => wspace.object);
        token.setup((t) => t.isCancellationRequested).returns(() => true);
        opts.setup((o) => o.cwd).returns(() => '/home/user/dev');
        opts.setup((o) => o.startDirectory).returns(() => './tests');

        const discoveryOutput: string = 'start';

        const tests: Tests = testsParser.parse(discoveryOutput, opts.object);

        expect(tests.testFiles.length).to.be.equal(0);
        expect(tests.testFunctions.length).to.be.equal(0);
        expect(tests.testSuites.length).to.be.equal(0);
        expect(tests.testFolders.length).to.be.equal(0);
    });
});
