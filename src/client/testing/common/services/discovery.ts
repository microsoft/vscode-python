// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { OutputChannel } from 'vscode';
import { traceError } from '../../../common/logger';
import * as internalScripts from '../../../common/process/internal/scripts';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { IOutputChannel } from '../../../common/types';
import { captureTelemetry } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { ITestDiscoveryService, TestDiscoveryOptions, Tests } from '../types';
import { DiscoveredTests, ITestDiscoveredTestParser } from './types';

@injectable()
export class TestsDiscoveryService implements ITestDiscoveryService {
    constructor(
        @inject(IPythonExecutionFactory) private readonly execFactory: IPythonExecutionFactory,
        @inject(ITestDiscoveredTestParser) private readonly parser: ITestDiscoveredTestParser,
        @inject(IOutputChannel) @named(TEST_OUTPUT_CHANNEL) private readonly outChannel: OutputChannel,
    ) {}
    @captureTelemetry(EventName.UNITTEST_DISCOVER_WITH_PYCODE, undefined, true)
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        try {
            const discoveredTests = await this.exec(options);
            return this.parser.parse(options.workspaceFolder, discoveredTests);
        } catch (ex) {
            if (ex.stdout) {
                traceError('Failed to parse discovered Test', new Error(ex.stdout));
            }
            traceError('Failed to parse discovered Test', ex);
            throw ex;
        }
    }
    public async exec(options: TestDiscoveryOptions): Promise<DiscoveredTests[]> {
        const [args, parse] = internalScripts.testing_tools.run_adapter(options.args);
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: options.workspaceFolder,
        };
        const execService = await this.execFactory.createActivatedEnvironment(creationOptions);
        const spawnOptions: SpawnOptions = {
            token: options.token,
            cwd: options.cwd,
            throwOnStdErr: true,
        };
        this.outChannel.appendLine(`python ${args.join(' ')}`);
        const proc = await execService.exec(args, spawnOptions);
        try {
            return parse(proc.stdout);
        } catch (ex) {
            ex.stdout = proc.stdout;
            throw ex; // re-throw
        }
    }
}
