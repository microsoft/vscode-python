// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable-next-line:max-func-body-length

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import { CancellationToken } from 'vscode';
import { IServiceContainer } from '../../../client/ioc/types';
import { NOSETEST_PROVIDER } from '../../../client/testing/common/constants';
import { ITestDiscoveryService, ITestRunner, ITestsParser, Options, TestDiscoveryOptions, Tests } from '../../../client/testing/common/types';
import { TestDiscoveryService } from '../../../client/testing/nosetest/services/discoveryService';
import { IArgumentsService, TestFilter } from '../../../client/testing/types';

use(chaipromise);

// tslint:disable-next-line: max-func-body-length
suite('Unit Tests - nose - Discovery', () => {
    let discoveryService: ITestDiscoveryService;
    let argsService: typeMoq.IMock<IArgumentsService>;
    let testParser: typeMoq.IMock<ITestsParser>;
    let runner: typeMoq.IMock<ITestRunner>;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        argsService = typeMoq.Mock.ofType<IArgumentsService>();
        testParser = typeMoq.Mock.ofType<ITestsParser>();
        runner = typeMoq.Mock.ofType<ITestRunner>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsService), typeMoq.It.isAny())).returns(() => argsService.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ITestRunner), typeMoq.It.isAny())).returns(() => runner.object);

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
            testFolders: []
        };
        argsService
            .setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner
            .setup(r => r.run(typeMoq.It.isValue(NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--collect-only');
                expect(opts.args).to.include('-vvv');
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser
            .setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested).returns(() => false);

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
            testFolders: []
        };
        argsService
            .setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner
            .setup(r => r.run(typeMoq.It.isValue(NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts: Options) => {
                expect(opts.args).to.include('--collect-only');
                expect(opts.args).to.include('-vvv');
            })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser
            .setup(t => t.parse(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());

        const options = typeMoq.Mock.ofType<TestDiscoveryOptions>();
        const token = typeMoq.Mock.ofType<CancellationToken>();
        token
            .setup(t => t.isCancellationRequested)
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
