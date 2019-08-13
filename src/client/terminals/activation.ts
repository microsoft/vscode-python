// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
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

@injectable()
export class ExtensionActivationForTerminalActivation implements IExtensionSingleActivationService {
    constructor(
        @inject(IExperimentsManager) private experiments: IExperimentsManager,
        @inject(ICommandManager) private commands: ICommandManager
    ) { }
    public async activate(): Promise<void> {
        this.checkExperiments();
    }

    // Nothing after this point is part of the IExtensionActivationService interface.

    public checkExperiments() {
        if (this.experiments.inExperiment(ShowPlayIcon.icon1)) {
            this.commands.executeCommand('setContext', 'python.showPlayIcon1', true)
                .then(noop, noop);
        } else if (this.experiments.inExperiment(ShowPlayIcon.icon2)) {
            this.commands.executeCommand('setContext', 'python.showPlayIcon2', true)
                .then(noop, noop);
        } else {
            this.experiments.sendTelemetryIfInExperiment(ShowPlayIcon.control);
        }
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
