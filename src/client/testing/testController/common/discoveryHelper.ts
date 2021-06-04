// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OutputChannel } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { RawDiscoveredTests } from '../../common/services/types';
import { TestDiscoveryOptions } from '../../common/types';

export interface ITestDiscoveryHelper {
    runTestDiscovery(options: TestDiscoveryOptions): Promise<RawDiscoveredTests[]>;
}

export class TestDiscoveryHelper implements ITestDiscoveryHelper {
    constructor(
        private readonly pythonExecFactory: IPythonExecutionFactory,
        private readonly outChannel: OutputChannel,
    ) {}

    public async runTestDiscovery(options: TestDiscoveryOptions): Promise<RawDiscoveredTests[]> {
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder,
        };
        const execService = await this.pythonExecFactory.createActivatedEnvironment(creationOptions);
        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true,
        };
        this.outChannel.appendLine(`python ${options.args.join(' ')}`);
        const proc = await execService.exec(options.args, spawnOptions);
        try {
            return JSON.parse(proc.stdout);
        } catch (ex) {
            ex.stdout = proc.stdout;
            throw ex; // re-throw
        }
    }
}
