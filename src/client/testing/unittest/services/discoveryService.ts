// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { Options } from '../../common/runner';
import { ITestDiscoveryService, ITestRunner, ITestsParser, TestDiscoveryOptions, Tests } from '../../common/types';
import { IArgumentsHelper } from '../../types';

type UnitTestDiscoveryOptions = TestDiscoveryOptions & {
    startDirectory: string;
    pattern: string;
};

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    private readonly argsHelper: IArgumentsHelper;
    private readonly runner: ITestRunner;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(ITestsParser) @named(UNITTEST_PROVIDER) private testParser: ITestsParser
    ) {
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
        this.runner = serviceContainer.get<ITestRunner>(ITestRunner);
    }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        const pythonScript = this.getDiscoveryScript(options);
        const unitTestOptions = this.translateOptions(options);
        const runOptions: Options = {
            args: ['-c', pythonScript],
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token: options.token,
            outChannel: options.outChannel,
        };

        const data = await this.runner.run(UNITTEST_PROVIDER, runOptions);

        if (options.token && options.token.isCancellationRequested) {
            return Promise.reject<Tests>('cancelled');
        }

        return this.testParser.parse(data, unitTestOptions);
    }
    public getDiscoveryScript(options: TestDiscoveryOptions): string {
        const unitTestOptions = this.translateOptions(options);
        return `
import unittest
loader = unittest.TestLoader()
suites = loader.discover("${unitTestOptions.startDirectory}", pattern="${unitTestOptions.pattern}")
print("start") #Don't remove this line
for suite in suites._tests:
    for cls in suite._tests:
        try:
            for m in cls._tests:
                print(m.id())
        except:
            pass`;
    }
    public translateOptions(options: TestDiscoveryOptions): UnitTestDiscoveryOptions {
        return {
            ...options,
            startDirectory: this.getStartDirectory(options),
            pattern: this.getTestPattern(options),
        };
    }
    private getStartDirectory(options: TestDiscoveryOptions) {
        const shortValue = this.argsHelper.getOptionValues(options.args, '-s');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(options.args, '--start-directory');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return '.';
    }
    private getTestPattern(options: TestDiscoveryOptions) {
        const shortValue = this.argsHelper.getOptionValues(options.args, '-p');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(options.args, '--pattern');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return 'test*.py';
    }
}
