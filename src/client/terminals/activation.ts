// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { IExtensionActivationService } from '../activation/types';
import { ICommandNameArgumentTypeMapping } from '../common/application/commands';
import {
    ICommandManager, ITerminalManager, IWorkspaceService
} from '../common/application/types';
import { ShowPlayIcon } from '../common/experimentGroups';
import { ITerminalActivator } from '../common/terminal/types';
import {
    IDisposable, IDisposableRegistry, IExperimentsManager, Resource
} from '../common/types';
import { noop } from '../common/utils/misc';
import { ITerminalAutoActivation } from './types';

@injectable()
export class ExtensionActivationForTerminalActivation implements IExtensionActivationService {
    private check: () => void;
    constructor(
        @inject(IExperimentsManager) experiments: IExperimentsManager,
        @inject(ICommandManager) commands: ICommandManager,
        check?: () => void
    ) {
        if (check === undefined) {
            check = () => {
                checkExperiments(experiments, commands);
            };
        }
        this.check = check;
    }
    public async activate(_resource: Resource): Promise<void> {
        this.check();
    }
}

interface IExperiments {
    inExperiment(experimentName: string): boolean;
    sendTelemetryIfInExperiment(experimentName: string): void;
}

interface ICommands {
    executeCommand<T, E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(command: E, ...rest: U): Thenable<T | undefined>;
}

export function checkExperiments(
    experiments: IExperiments,
    commands: ICommands
) {
    if (experiments.inExperiment(ShowPlayIcon.icon1)) {
        commands.executeCommand('setContext', 'python.showPlayIcon1', true)
            .then(noop, noop);
    } else if (experiments.inExperiment(ShowPlayIcon.icon2)) {
        commands.executeCommand('setContext', 'python.showPlayIcon2', true)
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
