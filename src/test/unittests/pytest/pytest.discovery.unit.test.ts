// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { PYTEST_PROVIDER } from '../../../client/unittests/common/constants';
import { TestsHelper } from '../../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/unittests/common/testVisitors/flatteningVisitor';
import { FlattenedTestFunction, ITestDiscoveryService, ITestRunner, ITestsHelper, ITestsParser, Options, TestDiscoveryOptions, Tests } from '../../../client/unittests/common/types';
import { TestDiscoveryService } from '../../../client/unittests/pytest/services/discoveryService';
import { TestsParser as PyTestsParser } from '../../../client/unittests/pytest/services/parserService';
import { IArgumentsService, TestFilter } from '../../../client/unittests/types';

use(chaipromise);

suite('Unit Tests - PyTest - Discovery', () => {
    let discoveryService: ITestDiscoveryService;
    let argsService: typeMoq.IMock<IArgumentsService>;
    let testParser: typeMoq.IMock<ITestsParser>;
    let runner: typeMoq.IMock<ITestRunner>;
    let helper: typeMoq.IMock<ITestsHelper>;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        argsService = typeMoq.Mock.ofType<IArgumentsService>();
        testParser = typeMoq.Mock.ofType<ITestsParser>();
        runner = typeMoq.Mock.ofType<ITestRunner>();
        helper = typeMoq.Mock.ofType<ITestsHelper>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsService), typeMoq.It.isAny()))
            .returns(() => argsService.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ITestsHelper), typeMoq.It.isAny()))
            .returns(() => helper.object);

        discoveryService = new TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args and single dir', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const dir = path.join('a', 'b', 'c');
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsService.setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        argsService.setup(a => a.getTestFolders(typeMoq.It.isValue(args)))
            .returns(() => [dir])
            .verifiable(typeMoq.Times.once());
        helper.setup(a => a.mergeTests(typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(PYTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--cache-clear');
                expect(opts.args).to.include('-s');
                expect(opts.args).to.include('--collect-only');
                expect(opts.args[opts.args.length - 1]).to.equal(dir);
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);

        const result = await discoveryService.discoverTests(options.object);

        expect(result).to.be.equal(tests);
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
        helper.verifyAll();
    });
    test('Ensure discovery is invoked with the right args and multiple dirs', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const dirs = [path.join('a', 'b', '1'), path.join('a', 'b', '2')];
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsService.setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        argsService.setup(a => a.getTestFolders(typeMoq.It.isValue(args)))
            .returns(() => dirs)
            .verifiable(typeMoq.Times.once());
        helper.setup(a => a.mergeTests(typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(PYTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--cache-clear');
                expect(opts.args).to.include('-s');
                expect(opts.args).to.include('--collect-only');
                const dir = opts.args[opts.args.length - 1];
                expect(dirs).to.include(dir);
                dirs.splice(dirs.indexOf(dir) - 1, 1);
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);

        const result = await discoveryService.discoverTests(options.object);

        expect(result).to.be.equal(tests);
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
        helper.verifyAll();
    });
    test('Ensure discovery is cancelled', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsService.setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        argsService.setup(a => a.getTestFolders(typeMoq.It.isValue(args)))
            .returns(() => [''])
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(PYTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--cache-clear');
                expect(opts.args).to.include('-s');
                expect(opts.args).to.include('--collect-only');
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());
        helper.setup(a => a.mergeTests(typeMoq.It.isAny()))
            .returns(() => tests);

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        token.setup(t => t.isCancellationRequested)
            .returns(() => true)
            .verifiable(typeMoq.Times.once());

        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        const promise = discoveryService.discoverTests(options.object);

        await expect(promise).to.eventually.be.rejectedWith('cancelled');
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('PyTest <= 3.6.3 identifies tests in files', async () => {
        const testHelper = typeMoq.Mock.ofType<TestsHelper>();
        testHelper.setup(h => h.flattenTestFiles(typeMoq.It.isAny()))
            .returns((v) => v);
        const testFlattener: TestFlatteningVisitor = new TestFlatteningVisitor();
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const appShell = typeMoq.Mock.ofType<IApplicationShell>();
        const cmdMgr = typeMoq.Mock.ofType<ICommandManager>();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IApplicationShell), typeMoq.It.isAny())).returns(() => appShell.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ICommandManager), typeMoq.It.isAny())).returns(() => cmdMgr.object);
        const forRealzTestHelper: TestsHelper = new TestsHelper(testFlattener, serviceContainer.object);
        const parser = new PyTestsParser(forRealzTestHelper);
        const outChannel = typeMoq.Mock.ofType<OutputChannel>();
        const cancelToken = typeMoq.Mock.ofType<CancellationToken>();
        cancelToken.setup(c => c.isCancellationRequested).returns(() => false);
        const wsFolder = typeMoq.Mock.ofType<Uri>();

        const options: TestDiscoveryOptions = {
            args: [],
            cwd: '/home/dekeeler/dev/github/d3r3kk/test/2347_pytest_codelens',
            ignoreCache: true,
            outChannel: outChannel.object,
            token: cancelToken.object,
            workspaceFolder: wsFolder.object
        };

        const content: string =
            // tslint:disable-next-line:quotemark
            " ============================= test session starts =============================\n \
    platform linux-- Python 3.5.2, pytest - 3.6.3, py - 1.6.0, pluggy - 0.6.0\n \
    rootdir: /home/dekeeler/dev/github/d3r3kk/test/2347_pytest_codelens, inifile:\n \
    collected 4 items\n \
    <Module 'tests/test_more_multiply.py' >\n \
      <Function 'test_times_100' >\n \
      <Function 'test_times_negative_1' >\n \
    <Module 'tests/test_multiply.py' >\n \
      <Function 'test_times_10' >\n \
      <Function 'test_times_2' >\n \
    \n \
    ======================== no tests ran in 0.14 seconds =========================\n";

        const parsedTests: Tests = parser.parse(content, options);
        expect(parsedTests).is.not.equal(undefined, 'Should have gotten tests extracted from the parsed pytest result content.');
        expect(parsedTests.testFiles.length).equals(2, 'Parsed pytest summary contained 2 test files.');
        expect(parsedTests.testFunctions.length).equals(4, 'Parsed pytest summary contained 4 test functions.');
        const findOneTest: FlattenedTestFunction | undefined = parsedTests.testFunctions.find(
            (tstFunc: FlattenedTestFunction) => {
                return tstFunc.testFunction.nameToRun === 'tests/test_more_multiply.py::test_times_100';
            });
        expect(findOneTest).is.not.equal(undefined, 'Could not find "tests/test_more_multiply.py::test_times_100" in tests.');
    });
    test('PyTest >= 3.7 identifies tests in files', async () => {
        const testHelper = typeMoq.Mock.ofType<TestsHelper>();
        testHelper.setup(h => h.flattenTestFiles(typeMoq.It.isAny()))
            .returns((v) => v);
        const testFlattener: TestFlatteningVisitor = new TestFlatteningVisitor();
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const appShell = typeMoq.Mock.ofType<IApplicationShell>();
        const cmdMgr = typeMoq.Mock.ofType<ICommandManager>();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IApplicationShell), typeMoq.It.isAny())).returns(() => appShell.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ICommandManager), typeMoq.It.isAny())).returns(() => cmdMgr.object);
        const forRealzTestHelper: TestsHelper = new TestsHelper(testFlattener, serviceContainer.object);
        const parser = new PyTestsParser(forRealzTestHelper);
        const outChannel = typeMoq.Mock.ofType<OutputChannel>();
        const cancelToken = typeMoq.Mock.ofType<CancellationToken>();
        cancelToken.setup(c => c.isCancellationRequested).returns(() => false);
        const wsFolder = typeMoq.Mock.ofType<Uri>();

        const options: TestDiscoveryOptions = {
            args: [],
            cwd: 'd:\\dev\\github\\d3r3kk\\test\\2347_pytest_codelens',
            ignoreCache: true,
            outChannel: outChannel.object,
            token: cancelToken.object,
            workspaceFolder: wsFolder.object
        };

        //         const content: string =
        //             // tslint:disable-next-line:quotemark
        //             "============================= test session starts =============================\n \
        // platform win32 -- Python 3.7.0, pytest-3.7.3, py-1.6.0, pluggy-0.7.1\n \
        // rootdir: d:\\dev\\github\\d3r3kk\\test\\2347_pytest_codelens, inifile:\n \
        // collected 4 items\n \
        // <Package 'd:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\2347_pytest_codelens'>\n \
        //   <Package 'd:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\2347_pytest_codelens\\\\tests'>\n \
        //     <Module 'test_more_multiply.py'>\n \
        //       <Function 'test_times_100'>\n \
        //       <Function 'test_times_negative_1'>\n \
        //     <Module 'test_multiply.py'>\n \
        //       <Function 'test_times_10'>\n \
        //       <Function 'test_times_2'>\n \
        // \n \
        // ======================== no tests ran in 0.03 seconds =========================\n";
        const content: string =
            // tslint:disable-next-line:quotemark
            "============================= test session starts =============================\n \
platform win32 -- Python 3.7.0, pytest-3.7.3, py-1.6.0, pluggy-0.7.1\n \
rootdir: d:\\dev\\github\\d3r3kk\\test\\2347_pytest_codelens, inifile:\n \
collected 6 items\n \
<Package 'd:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\2347_pytest_codelens'>\n \
  <Package 'd:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\2347_pytest_codelens\\\\tests'>\n \
    <Module 'test_more_multiply.py'>\n \
      <Function 'test_times_100'>\n \
      <Function 'test_times_negative_1'>\n \
      <Function 'test_derek_is_cool'>\n \
    <Module 'test_multiply.py'>\n \
      <Function 'test_times_10'>\n \
      <Function 'test_times_2'>\n \
    <Package 'd:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\2347_pytest_codelens\\\\tests\\\\further_tests'>\n \
      <Module 'test_gimme_5.py'>\n \
        <Function 'test_gimme_5'>\n \
\n \
======================== no tests ran in 0.05 seconds =========================\n";

        const parsedTests: Tests = parser.parse(content, options);
        expect(parsedTests).is.not.equal(undefined, 'Should have gotten tests extracted from the parsed pytest result content.');
        expect(parsedTests.testFiles.length).equals(3, 'Parsed pytest summary contained 2 test files.');
        expect(parsedTests.testFunctions.length).equals(6, 'Parsed pytest summary contained 4 test functions.');
        const findOneTest: FlattenedTestFunction | undefined = parsedTests.testFunctions.find(
            (tstFunc: FlattenedTestFunction) => {
                return tstFunc.testFunction.nameToRun === 'tests/test_more_multiply.py::test_times_100';
            });
        expect(findOneTest).is.not.equal(undefined, 'Could not find "tests/test_more_multiply.py::test_times_100" in tests.');
        const findTwoTest: FlattenedTestFunction | undefined = parsedTests.testFunctions.find(
            (tstFunc: FlattenedTestFunction) => {
                return tstFunc.testFunction.nameToRun === 'tests/further_tests/test_gimme_5.py::test_gimme_5';
            });
        expect(findTwoTest).is.not.equal(undefined, 'Could not find "tests/further_tests/test_gimme_5.py::test_gimme_5" in tests.');
    });

});
