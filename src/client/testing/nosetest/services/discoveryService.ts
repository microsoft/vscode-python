// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { CancellationTokenSource } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { NOSETEST_PROVIDER } from '../../common/constants';
import { Options } from '../../common/runner';
import { ITestDiscoveryService, ITestRunner, ITestsParser, TestDiscoveryOptions, Tests } from '../../common/types';
import { IArgumentsService, TestFilter } from '../../types';

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    private argsService: IArgumentsService;
    private runner: ITestRunner;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ITestsParser) @named(NOSETEST_PROVIDER) private testParser: ITestsParser
    ) {
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, NOSETEST_PROVIDER);
        this.runner = this.serviceContainer.get<ITestRunner>(ITestRunner);
    }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        // Remove unwanted arguments.
        const args = this.argsService.filterArguments(options.args, TestFilter.discovery);

        const token = options.token ? options.token : new CancellationTokenSource().token;
        const runOptions: Options = {
            args: ['--collect-only', '-vvv'].concat(args),
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token,
            outChannel: options.outChannel
        };

        const data = await this.runner.run(NOSETEST_PROVIDER, runOptions);
        if (options.token && options.token.isCancellationRequested) {
            return Promise.reject<Tests>('cancelled');
        }

        return this.testParser.parse(data, options);
    }
}
