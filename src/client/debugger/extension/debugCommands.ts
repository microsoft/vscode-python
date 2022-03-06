// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { inject, injectable } from 'inversify';
import { DebugConfiguration, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IDebugService } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposableRegistry } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ILaunchJsonReader } from './configuration/types';
import { DebugPurpose, LaunchRequestArguments } from '../types';

@injectable()
export class DebugCommands implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(ILaunchJsonReader) private readonly launchJsonReader: ILaunchJsonReader,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {}

    public activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Debug_In_Terminal, async (file?: Uri) => {
                sendTelemetryEvent(EventName.DEBUG_IN_TERMINAL_BUTTON);
                const config = await this.getDebugConfiguration(file);
                this.debugService.startDebugging(undefined, config);
            }),
        );
        return Promise.resolve();
    }

    private async getDebugConfiguration(uri?: Uri): Promise<DebugConfiguration> {
        const configs = (await this.launchJsonReader.getConfigurationsByUri(uri)).filter((c) => c.request === 'launch');
        for (const config of configs) {
            if ((config as LaunchRequestArguments).purpose?.includes(DebugPurpose.DebugInTerminal)) {
                if (!config.program && !config.module && !config.code) {
                    // This is only needed if people reuse debug-test for debug-in-terminal
                    config.program = uri?.fsPath ?? '${file}';
                }
                // Ensure that the purpose is cleared, this is so we can track if people accidentally
                // trigger this via F5 or Start with debugger.
                config.purpose = [];
                return config;
            }
        }
        return {
            name: `Debug ${uri ? path.basename(uri.fsPath) : 'File'}`,
            type: 'python',
            request: 'launch',
            program: uri?.fsPath ?? '${file}',
            console: 'integratedTerminal',
        };
    }
}
