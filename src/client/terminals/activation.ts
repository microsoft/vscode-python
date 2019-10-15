// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import {
    ICommandManager, IDocumentManager, ITerminalManager, IWorkspaceService
} from '../common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../common/constants';
import { ITerminalActivator } from '../common/terminal/types';
import {
    IDisposable, IDisposableRegistry, IExtensions
} from '../common/types';
import { noop } from '../common/utils/misc';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ITerminalAutoActivation } from './types';

@injectable()
export class ExtensionActivationForTerminalActivation implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private commands: ICommandManager,
        @inject(IExtensions) private extensions: IExtensions,
        @inject(IDisposableRegistry) disposables: IDisposable[]
    ) {
        disposables.push(this.extensions.onDidChange(this.activate.bind(this)));
    }

    public async activate(): Promise<void> {
        const isInstalled = this.isCodeRunnerInstalled();
        // Hide the play icon if code runner is installed, otherwise display the play icon.
        this.commands.executeCommand('setContext', 'python.showPlayIcon', !isInstalled)
            .then(noop, noop);
        sendTelemetryEvent(EventName.PLAY_BUTTON_ICON_DISABLED, undefined, { disabled: isInstalled });
    }

    private isCodeRunnerInstalled(): boolean {
        const extension = this.extensions.getExtension(CODE_RUNNER_EXTENSION_ID)!;
        return extension === undefined ? false : true;
    }
}

@injectable()
export class TerminalAutoActivation implements ITerminalAutoActivation {
    private handler?: IDisposable;
    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
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
        await this.activator.activateEnvironmentInTerminal(terminal, this.getActiveResource());
    }

    private getActiveResource(): Uri | undefined {
        if (this.documentManager.activeTextEditor && !this.documentManager.activeTextEditor.document.isUntitled) {
            return this.documentManager.activeTextEditor.document.uri;
        }

        return Array.isArray(this.workspaceService.workspaceFolders) && this.workspaceService.workspaceFolders.length > 0 ? this.workspaceService.workspaceFolders[0].uri : undefined;
    }
}
