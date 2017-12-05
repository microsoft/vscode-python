// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import 'reflect-metadata';
import { CancellationTokenSource } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../common/constants';
import { Options, run } from '../../common/runner';
import { ITestDiscoveryService, ITestsParser, TestDiscoveryOptions, Tests } from '../../common/types';

const argsToExcludeForDiscovery = ['-x', '--exitfirst',
    '--fixtures-per-test', '--pdb', '--runxfail',
    '--lf', '--last-failed', '--ff', '--failed-first',
    '--cache-show', '--cache-clear',
    '-v', '--verbose', '-q', '-quiet',
    '--disable-pytest-warnings', '-l', '--showlocals'];

type PytestDiscoveryOptions = TestDiscoveryOptions & {
    startDirectory: string;
    pattern: string;
};

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ITestsParser) @named(PYTEST_PROVIDER) private testParser: ITestsParser) { }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        // Remove unwanted arguments
        const args = options.args.filter(arg => {
            if (argsToExcludeForDiscovery.indexOf(arg.trim()) !== -1) {
                return false;
            }
            return true;
        });
        if (options.ignoreCache && args.indexOf('--cache-clear') === -1) {
            args.push('--cache-clear');
        }

        const token = options.token ? options.token : new CancellationTokenSource().token;
        const runOptions: Options = {
            args: args.concat(['--collect-only']),
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token,
            outChannel: options.outChannel
        };

        const data = await run(this.serviceContainer, PYTEST_PROVIDER, runOptions);
        if (options.token && options.token.isCancellationRequested) {
            return Promise.reject<Tests>('cancelled');
        }

        return this.testParser.parse(data, options);
    }
}
