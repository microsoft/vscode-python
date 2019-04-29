// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { CancellationToken } from 'vscode';
import { IServiceContainer } from '../../../client/ioc/types';
import { PYTEST_PROVIDER } from '../../../client/unittests/common/constants';
import {
    ITestDiscoveryService, ITestRunner, ITestsHelper,
    ITestsParser, Options, TestDiscoveryOptions, Tests
} from '../../../client/unittests/common/types';
import { TestDiscoveryService } from '../../../client/unittests/pytest/services/discoveryService';
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
});
