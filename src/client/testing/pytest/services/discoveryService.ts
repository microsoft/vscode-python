// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationTokenSource } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { ITestDiscoveryService, ITestsHelper, TestDiscoveryOptions, Tests } from '../../common/types';
import { IArgumentsService, TestFilter } from '../../types';

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    private argsService: IArgumentsService;
    private helper: ITestsHelper;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, PYTEST_PROVIDER);
        this.helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
    }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        const args = this.buildTestCollectionArgs(options);

        // Collect tests for each test directory separately and merge.
        const testDirectories = this.argsService.getTestFolders(options.args);
        if (testDirectories.length === 0) {
            const opts = {
                ...options,
                args
            };
            return this.discoverTestsInTestDirectory(opts);
        }
        const results = await Promise.all(
            testDirectories.map((testDir) => {
                // Add test directory as a positional argument.
                const opts = {
                    ...options,
                    args: [...args, testDir]
                };
                return this.discoverTestsInTestDirectory(opts);
            })
        );

        return this.helper.mergeTests(results);
    }
    protected buildTestCollectionArgs(options: TestDiscoveryOptions) {
        // Remove unwnted arguments (which happen to be test directories & test specific args).
        const args = this.argsService.filterArguments(options.args, TestFilter.discovery);
        if (options.ignoreCache && args.indexOf('--cache-clear') === -1) {
            args.splice(0, 0, '--cache-clear');
        }
        if (args.indexOf('-s') === -1) {
            args.splice(0, 0, '-s');
        }
        args.splice(0, 0, '--rootdir', options.workspaceFolder.fsPath);
        return args;
    }
    protected async discoverTestsInTestDirectory(options: TestDiscoveryOptions): Promise<Tests> {
        const token = options.token ? options.token : new CancellationTokenSource().token;
        const discoveryOptions = { ...options };
        discoveryOptions.args = ['discover', 'pytest', '--', ...options.args];
        discoveryOptions.token = token;

        const discoveryService = this.serviceContainer.get<ITestDiscoveryService>(ITestDiscoveryService, 'common');
        if (discoveryOptions.token && discoveryOptions.token.isCancellationRequested) {
            return Promise.reject<Tests>('cancelled');
        }

        return discoveryService.discoverTests(discoveryOptions);
    }
}
