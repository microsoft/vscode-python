// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { Options, run } from '../../common/runner';
import { ITestDiscoveryService, ITestsParser, TestDiscoveryOptions, Tests } from '../../common/types';

type UnitTestDiscoveryOptions = TestDiscoveryOptions & {
    startDirectory: string;
    pattern: string;
};

@injectable()
export class TestDiscoveryService implements ITestDiscoveryService {
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ITestsParser) @named(UNITTEST_PROVIDER) private testParser: ITestsParser) { }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        const pythonScript = this.getDiscoveryScript(options);
        const unitTestOptions = this.translateOptions(options);
        const runOptions: Options = {
            args: ['-c', pythonScript],
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token: options.token,
            outChannel: options.outChannel
        };

        const data = await run(this.serviceContainer, UNITTEST_PROVIDER, runOptions);

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
        const unitTestOptions = { ...options } as UnitTestDiscoveryOptions;
        unitTestOptions.startDirectory = this.getStartDirectory(options);
        unitTestOptions.pattern = this.getTestPattern(options);
        return unitTestOptions;
    }
    private getStartDirectory(options: TestDiscoveryOptions) {
        let startDirectory = '.';
        const indexOfStartDir = options.args.findIndex(arg => arg.indexOf('-s') === 0);
        if (indexOfStartDir >= 0) {
            const startDir = options.args[indexOfStartDir].trim();
            if (startDir.trim() === '-s' && options.args.length >= indexOfStartDir) {
                // Assume the next items is the directory
                startDirectory = options.args[indexOfStartDir + 1];
            } else {
                startDirectory = startDir.substring(2).trim();
                if (startDirectory.startsWith('=') || startDirectory.startsWith(' ')) {
                    startDirectory = startDirectory.substring(1);
                }
            }
        }
        return startDirectory;
    }
    private getTestPattern(options: TestDiscoveryOptions) {
        let pattern = 'test*.py';
        const indexOfPattern = options.args.findIndex(arg => arg.indexOf('-p') === 0);
        if (indexOfPattern >= 0) {
            const patternValue = options.args[indexOfPattern].trim();
            if (patternValue.trim() === '-p' && options.args.length >= indexOfPattern) {
                // Assume the next items is the directory
                pattern = options.args[indexOfPattern + 1];
            } else {
                pattern = patternValue.substring(2).trim();
                if (pattern.startsWith('=')) {
                    pattern = pattern.substring(1);
                }
            }
        }
        return pattern;
    }
}
