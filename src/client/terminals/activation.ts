// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import {
    ICommandManager, ITerminalManager, IWorkspaceService
} from '../common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../common/constants';
import { ITerminalActivator } from '../common/terminal/types';
import {
    IDisposable, IDisposableRegistry, IExtensions
} from '../common/types';
import { noop } from '../common/utils/misc';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ITerminalAutoActivation } from './types';

@injectable()
export class ExtensionActivationForTerminalActivation implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private commands: ICommandManager,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer
    ) { }

    public async activate(): Promise<void> {
        if (!this.isCodeRunnerInstalled()) {
            // If code runner is NOT installed, display the play icon.
            this.commands.executeCommand('setContext', 'python.showPlayIcon', true)
                .then(noop, noop);
            sendTelemetryEvent(EventName.PLAY_BUTTON_ICON_DISABLED, undefined, { disabled: false });
        } else {
            sendTelemetryEvent(EventName.PLAY_BUTTON_ICON_DISABLED, undefined, { disabled: true });
        }
    }

    private isCodeRunnerInstalled(): boolean {
        const extensions = this.serviceContainer.get<IExtensions>(IExtensions);
        const extension = extensions.getExtension(CODE_RUNNER_EXTENSION_ID)!;
        return extension === undefined ? false : true;
    }
}

@injectable()
export class TerminalAutoActivation implements ITerminalAutoActivation {
    private handler?: IDisposable;
    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ITerminalActivator) private readonly activator: ITerminalActivator,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        if (this.handler) {
            this.handler.dispose();
            this.handler = undefined;
        }
    }
    public register() {
        if (this.handler) {
            return;
        }
        this.handler = this.terminalManager.onDidOpenTerminal(this.activateTerminal, this);
    }
    private async activateTerminal(terminal: Terminal): Promise<void> {
        // If we have just one workspace, then pass that as the resource.
        // Until upstream VSC issue is resolved https://github.com/Microsoft/vscode/issues/63052.
        const workspaceFolder =
            this.workspaceService.hasWorkspaceFolders && this.workspaceService.workspaceFolders!.length > 0
                ? this.workspaceService.workspaceFolders![0].uri
                : undefined;
        await this.activator.activateEnvironmentInTerminal(terminal, workspaceFolder);
    }
}
