// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { TestCommandOptions } from '../../common/types';
import { runTestCommand } from '../common/commandRunner';
import { DiscoveredTestPayload, ITestDiscoveryAdapter } from '../common/types';

export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    constructor(
        public executionFactory: IPythonExecutionFactory,
        public configSettings: IConfigurationService,
        public port: number,
    ) {}

    public async discoverTests(uri: Uri): Promise<DiscoveredTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;

        const command = this.buildDiscoveryCommand(unittestArgs);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            port: this.port,
            args: command,
            cwd: uri.fsPath,
            ignoreCache: false,
        };

        const result = await runTestCommand(this.executionFactory, options);
        const testData = JSON.parse(result);

        return Promise.resolve(testData);
    }

    private buildDiscoveryCommand(args: string[]): string[] {
        const discoveryScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');
        return [discoveryScript, '--port', `${this.port}`, '--', ...args];
    }
}
