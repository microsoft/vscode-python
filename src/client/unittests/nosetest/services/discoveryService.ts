// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import 'reflect-metadata';
import { CancellationTokenSource } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { NOSETEST_PROVIDER } from '../../common/constants';
import { Options, run } from '../../common/runner';
import { ITestDiscoveryService, ITestsParser, TestDiscoveryOptions, Tests } from '../../common/types';

const argsToExcludeForDiscovery = ['-v', '--verbose',
    '-q', '--quiet', '-x', '--stop',
    '--with-coverage', '--cover-erase', '--cover-tests',
    '--cover-inclusive', '--cover-html', '--cover-branches', '--cover-xml',
    '--pdb', '--pdb-failures', '--pdb-errors',
    '--failed', '--process-restartworker', '--with-xunit'];
const settingsInArgsToExcludeForDiscovery = ['--verbosity'];

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ITestsParser) @named(NOSETEST_PROVIDER) private testParser: ITestsParser) { }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        // Remove unwanted arguments
        const args = options.args.filter(arg => {
            if (argsToExcludeForDiscovery.indexOf(arg.trim()) !== -1) {
                return false;
            }
            if (settingsInArgsToExcludeForDiscovery.some(setting => setting.indexOf(arg.trim()) === 0)) {
                return false;
            }
            return true;
        });

        const token = options.token ? options.token : new CancellationTokenSource().token;
        const runOptions: Options = {
            args: args.concat(['--collect-only', '-vvv']),
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token,
            outChannel: options.outChannel
        };

        const data = await run(this.serviceContainer, NOSETEST_PROVIDER, runOptions);
        if (options.token && options.token.isCancellationRequested) {
            return Promise.reject<Tests>('cancelled');
        }

        return this.testParser.parse(data, options);
    }
}
