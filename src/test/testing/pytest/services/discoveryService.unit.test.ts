// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { CancellationTokenSource, Uri } from 'vscode';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { PYTEST_PROVIDER } from '../../../../client/testing/common/constants';
import { TestsDiscoveryService } from '../../../../client/testing/common/services/discovery';
import { TestsHelper } from '../../../../client/testing/common/testUtils';
import {
    IArgumentsService,
    ITestDiscoveryService,
    ITestsHelper,
    TestDiscoveryOptions,
    TestFilter,
    Tests,
} from '../../../../client/testing/common/types';
import { ArgumentsService } from '../../../../client/testing/pytest/services/argsService';
import { TestDiscoveryService } from '../../../../client/testing/pytest/services/discoveryService';
import { MockOutputChannel } from '../../../mockClasses';

function fakeTests(fake: string): Tests {
    return (fake as unknown) as Tests;
}

suite('Unit Tests - PyTest - Discovery', () => {
    class DiscoveryService extends TestDiscoveryService {
        public buildTestCollectionArgs(options: TestDiscoveryOptions): string[] {
            return super.buildTestCollectionArgs(options);
        }

        public discoverTestsInTestDirectory(options: TestDiscoveryOptions): Promise<Tests> {
            return super.discoverTestsInTestDirectory(options);
        }
    }
    let discoveryService: DiscoveryService;
    let serviceContainer: IServiceContainer;
    let argsService: IArgumentsService;
    let helper: ITestsHelper;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        helper = mock(TestsHelper);
        argsService = mock(ArgumentsService);

        when(serviceContainer.get<IArgumentsService>(IArgumentsService, PYTEST_PROVIDER)).thenReturn(
            instance(argsService),
        );
        when(serviceContainer.get<ITestsHelper>(ITestsHelper)).thenReturn(instance(helper));
        discoveryService = new DiscoveryService(instance(serviceContainer));
    });
    test('Ensure discovery is invoked when there are no test directories', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: true,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };
        const args = ['1', '2', '3'];
        const discoveredTests = fakeTests('Hello World');
        discoveryService.buildTestCollectionArgs = () => args;
        discoveryService.discoverTestsInTestDirectory = () => Promise.resolve(discoveredTests);
        when(argsService.getTestFolders(deepEqual(options.args))).thenReturn([]);

        const tests = await discoveryService.discoverTests(options);

        expect(tests).equal(discoveredTests);
    });
    test('Ensure discovery is invoked when there are multiple test directories', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: true,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };
        const args = ['1', '2', '3'];
        discoveryService.buildTestCollectionArgs = () => args;
        const directories = ['a', 'b'];
        discoveryService.discoverTestsInTestDirectory = async (opts) => {
            const dir = opts.args[opts.args.length - 1];
            if (dir === 'a') {
                return fakeTests('Result A');
            }
            if (dir === 'b') {
                return fakeTests('Result B');
            }
            throw new Error('Unrecognized directory');
        };
        when(argsService.getTestFolders(deepEqual(options.args))).thenReturn(directories);
        when(helper.mergeTests(deepEqual([fakeTests('Result A'), fakeTests('Result B')]))).thenReturn(
            fakeTests('mergedTests'),
        );

        const tests = await discoveryService.discoverTests(options);

        verify(helper.mergeTests(deepEqual([fakeTests('Result A'), fakeTests('Result B')]))).once();
        expect(tests).equal('mergedTests');
    });
    test('Build collection arguments', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args', 'and some more'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: false,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };

        const filteredArgs = options.args;
        const expectedArgs = ['--rootdir', Uri.file(__dirname).fsPath, '-s', ...filteredArgs];
        when(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).thenReturn(filteredArgs);

        const args = discoveryService.buildTestCollectionArgs(options);

        expect(args).deep.equal(expectedArgs);
        verify(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).once();
    });
    test('Build collection arguments with ignore in args', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args', 'and some more', '--cache-clear'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: true,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };

        const filteredArgs = options.args;
        const expectedArgs = ['--rootdir', Uri.file(__dirname).fsPath, '-s', ...filteredArgs];
        when(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).thenReturn(filteredArgs);

        const args = discoveryService.buildTestCollectionArgs(options);

        expect(args).deep.equal(expectedArgs);
        verify(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).once();
    });
    test('Build collection arguments (& ignore)', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args', 'and some more'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: true,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };

        const filteredArgs = options.args;
        const expectedArgs = ['--rootdir', Uri.file(__dirname).fsPath, '-s', '--cache-clear', ...filteredArgs];
        when(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).thenReturn(filteredArgs);

        const args = discoveryService.buildTestCollectionArgs(options);

        expect(args).deep.equal(expectedArgs);
        verify(argsService.filterArguments(deepEqual(options.args), TestFilter.discovery)).once();
    });
    test('Discover using common discovery', async () => {
        const options: TestDiscoveryOptions = {
            args: ['some args', 'and some more'],
            cwd: Uri.file(__dirname).fsPath,
            ignoreCache: true,
            outChannel: new MockOutputChannel('Tests'),
            token: new CancellationTokenSource().token,
            workspaceFolder: Uri.file(__dirname),
        };
        const expectedDiscoveryArgs = ['discover', 'pytest', '--', ...options.args];
        const discoveryOptions = { ...options };
        discoveryOptions.args = expectedDiscoveryArgs;

        const commonDiscoveryService = mock(TestsDiscoveryService);
        const discoveredTests = fakeTests('Hello');
        when(serviceContainer.get<ITestDiscoveryService>(ITestDiscoveryService, 'common')).thenReturn(
            instance(commonDiscoveryService),
        );
        when(commonDiscoveryService.discoverTests(deepEqual(discoveryOptions))).thenResolve(discoveredTests);

        const tests = await discoveryService.discoverTestsInTestDirectory(options);

        verify(commonDiscoveryService.discoverTests(deepEqual(discoveryOptions))).once();
        expect(tests).equal(discoveredTests);
    });
});
