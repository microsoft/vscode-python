// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import {
    ICommandManager, ITerminalManager, IWorkspaceService
} from '../common/application/types';
import { ShowPlayIcon } from '../common/experimentGroups';
import { ITerminalActivator } from '../common/terminal/types';
import {
    IDisposable, IDisposableRegistry, IExperimentsManager
} from '../common/types';
import { noop } from '../common/utils/misc';
import { ITerminalAutoActivation } from './types';

// This is called directly when activating the extension.
export function activate(
    experiments: IExperimentsManager,
    commands: ICommandManager,
    autoActivation: ITerminalAutoActivation
) {
    checkExperiments(experiments, commands);

    autoActivation.register();
}

function checkExperiments(
    experiments: IExperimentsManager,
    commands: ICommandManager
) {
    if (experiments.inExperiment(ShowPlayIcon.experiment)) {
        commands.executeCommand('setContext', 'python.showPlayIcon', true)
            .then(noop, noop);
    } else {
        experiments.sendTelemetryIfInExperiment(ShowPlayIcon.control);
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
