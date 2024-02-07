// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ITerminalManager,
    IWorkspaceService,
} from '../../common/application/types';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { TerminalShellType } from '../../common/terminal/types';
import { IDisposableRegistry, IPersistentStateFactory } from '../../common/types';
import { createDeferred, sleep } from '../../common/utils/async';
import { cache } from '../../common/utils/decorators';
import { traceError, traceInfo, traceVerbose } from '../../logging';
import { IShellIntegrationService } from '../types';

/**
 * This is a list of shells which support shell integration:
 * https://code.visualstudio.com/docs/terminal/shell-integration
 */
const ShellIntegrationShells = [
    TerminalShellType.powershell,
    TerminalShellType.powershellCore,
    TerminalShellType.bash,
    TerminalShellType.zsh,
    TerminalShellType.fish,
];

export const isShellIntegrationWorkingKey = 'SHELL_INTEGRATION_WORKING_KEY';

@injectable()
export class ShellIntegrationService implements IShellIntegrationService {
    /**
     * It seems to have a couple of issues:
     * * Ends up cluterring terminal history
     * * Does not work for hidden terminals: https://github.com/microsoft/vscode/issues/199611
     */
    private readonly USE_COMMAND_APPROACH = false;

    private isWorkingForShell = new Set<TerminalShellType>();

    private readonly didChange = new EventEmitter<void>();

    private isDataWriteEventWorking = true;

    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {
        try {
            this.appShell.onDidWriteTerminalData(
                (e) => {
                    if (e.data.includes('\x1b]633;A\x07')) {
                        let { shell } = this.appEnvironment;
                        if ('shellPath' in e.terminal.creationOptions && e.terminal.creationOptions.shellPath) {
                            shell = e.terminal.creationOptions.shellPath;
                        }
                        const shellType = identifyShellFromShellPath(shell);
                        const wasWorking = this.isWorkingForShell.has(shellType);
                        this.isWorkingForShell.add(shellType);
                        if (!wasWorking) {
                            // If it wasn't working previously, status has changed.
                            this.didChange.fire();
                        }
                    }
                },
                this,
                this.disposables,
            );
            this.appEnvironment.onDidChangeShell(
                async (shell: string) => {
                    this.createDummyHiddenTerminal(shell);
                },
                this,
                this.disposables,
            );
            this.createDummyHiddenTerminal(this.appEnvironment.shell);
        } catch (ex) {
            this.isDataWriteEventWorking = false;
            traceError('Unable to check if shell integration is active', ex);
        }
    }

    public readonly onDidChangeStatus = this.didChange.event;

    public async isWorking(shell: string): Promise<boolean> {
        return this._isWorking(shell).catch((ex) => {
            traceError(`Failed to determine if shell supports shell integration`, shell, ex);
            return false;
        });
    }

    @cache(-1, true)
    public async _isWorking(shell: string): Promise<boolean> {
        const isEnabled = this.workspaceService
            .getConfiguration('terminal')
            .get<boolean>('integrated.shellIntegration.enabled')!;
        if (!isEnabled) {
            traceVerbose('Shell integrated is disabled in user settings.');
        }
        const shellType = identifyShellFromShellPath(shell);
        const isSupposedToWork = isEnabled && ShellIntegrationShells.includes(shellType);
        if (!isSupposedToWork) {
            return false;
        }
        if (!this.USE_COMMAND_APPROACH) {
            // For now, based on problems with using the command approach, use terminal data write event.
            if (!this.isDataWriteEventWorking) {
                // Assume shell integration is working, if data write event isn't working.
                return true;
            }
            if (shellType === TerminalShellType.powershell || shellType === TerminalShellType.powershellCore) {
                // Due to upstream bug: https://github.com/microsoft/vscode/issues/204616, assume shell integration is working for now.
                return true;
            }
            if (!this.isWorkingForShell.has(shellType)) {
                // Maybe data write event has not been processed yet, wait a bit.
                await sleep(1000);
            }
            return this.isWorkingForShell.has(shellType);
        }
        const key = `${isShellIntegrationWorkingKey}_${shellType}`;
        const persistedResult = this.persistentStateFactory.createGlobalPersistentState<boolean>(key);
        if (persistedResult.value !== undefined) {
            return persistedResult.value;
        }
        const result = await this.checkIfWorkingByRunningCommand(shell);
        // Persist result to storage to avoid running commands unncecessary.
        await persistedResult.updateValue(result);
        return result;
    }

    /**
     * Creates a dummy terminal so that we are guaranteed a data write event for this shell type.
     */
    private createDummyHiddenTerminal(shell: string) {
        this.terminalManager.createTerminal({
            shellPath: shell,
            hideFromUser: true,
        });
    }

    private async checkIfWorkingByRunningCommand(shell: string): Promise<boolean> {
        const shellType = identifyShellFromShellPath(shell);
        const deferred = createDeferred<void>();
        const timestamp = new Date().getTime();
        const name = `Python ${timestamp}`;
        const onDidExecuteTerminalCommand = this.appShell.onDidExecuteTerminalCommand?.bind(this.appShell);
        if (!onDidExecuteTerminalCommand) {
            // Proposed API is not available, assume shell integration is working at this point.
            return true;
        }
        try {
            const disposable = onDidExecuteTerminalCommand((e) => {
                if (e.terminal.name === name) {
                    deferred.resolve();
                }
            });
            const terminal = this.terminalManager.createTerminal({
                name,
                shellPath: shell,
                hideFromUser: true,
            });
            terminal.sendText(`echo ${shell}`);
            const success = await Promise.race([sleep(3000).then(() => false), deferred.promise.then(() => true)]);
            disposable.dispose();
            if (!success) {
                traceInfo(`Shell integration is not working for ${shellType}`);
            }
            return success;
        } catch (ex) {
            traceVerbose(`Proposed API is not available, failed to subscribe to onDidExecuteTerminalCommand`, ex);
            // Proposed API is not available, assume shell integration is working at this point.
            return true;
        }
    }
}
