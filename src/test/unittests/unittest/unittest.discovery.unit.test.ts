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
import { UNITTEST_PROVIDER } from '../../../client/unittests/common/constants';
import { ITestDiscoveryService, ITestRunner, ITestsParser, Options, TestDiscoveryOptions, Tests } from '../../../client/unittests/common/types';
import { IArgumentsHelper } from '../../../client/unittests/types';
import { TestDiscoveryService } from '../../../client/unittests/unittest/services/discoveryService';

use(chaipromise);

suite('Unit Tests - Unittest - Discovery', () => {
    let discoveryService: ITestDiscoveryService;
    let argsHelper: typeMoq.IMock<IArgumentsHelper>;
    let testParser: typeMoq.IMock<ITestsParser>;
    let runner: typeMoq.IMock<ITestRunner>;
    const dir = path.join('a', 'b', 'c');
    const pattern = 'Pattern_To_Search_For';
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        argsHelper = typeMoq.Mock.ofType<IArgumentsHelper>();
        testParser = typeMoq.Mock.ofType<ITestsParser>();
        runner = typeMoq.Mock.ofType<ITestRunner>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);

        discoveryService = new TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args with start directory defined with -s', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(dir);
                expect(opts.args[1]).to.not.contain('loader.discover("."');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args with start directory defined with --start-directory', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(dir);
                expect(opts.args[1]).to.not.contain('loader.discover("."');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a start directory', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.not.contain(dir);
                expect(opts.args[1]).to.contain('loader.discover("."');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern defined with -p', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(pattern);
                expect(opts.args[1]).to.not.contain('test*.py');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern defined with ---pattern', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.contain(pattern);
                expect(opts.args[1]).to.not.contain('test*.py');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is invoked with the right args without a pattern not defined', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('-c');
                expect(opts.args[1]).to.not.contain(pattern);
                expect(opts.args[1]).to.contain('test*.py');
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
        runner.verifyAll();
        testParser.verifyAll();
    });
    test('Ensure discovery is cancelled', async () => {
        const args: string[] = [];
        const runOutput = 'xyz';
        const tests: Tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);

        const promise = discoveryService.discoverTests(options.object);

        await expect(promise).to.eventually.be.rejectedWith('cancelled');
        runner.verifyAll();
        testParser.verifyAll();
    });
});
