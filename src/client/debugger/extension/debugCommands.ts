// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IDebugService } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposableRegistry } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

@injectable()
export class DebugCommands implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {}

    public activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Debug_In_Terminal, (file: Uri) => {
                sendTelemetryEvent(EventName.DEBUG_IN_TERMINAL_BUTTON);
                this.debugService.startDebugging(undefined, {
                    name: `Debug ${path.basename(file.fsPath)}`,
                    type: 'python',
                    request: 'launch',
                    program: file.fsPath,
                    console: 'integratedTerminal',
                });
            }),
        );
        return Promise.resolve();
    }
}
