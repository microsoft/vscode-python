// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import { Commands } from '../../../common/constants';
import { IDisposable, IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../../../common/types';
import { safeInterpretersKey, unsafeInterpreterPromptKey, unsafeInterpretersKey } from '../constants';
import { IInterpreterSecurityCommands } from '../types';

@injectable()
export class InterpreterSecurityCommands implements IInterpreterSecurityCommands {
    private unsafeInterpreterPromptEnabled: IPersistentState<boolean>;
    private unsafeInterpreters: IPersistentState<string[]>;
    private safeInterpreters: IPersistentState<string[]>;
    private readonly activatedWorkspacesKeys = new Set<string>();
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[]
    ) {
        this.unsafeInterpreterPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            unsafeInterpreterPromptKey,
            true
        );
        this.unsafeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            unsafeInterpretersKey,
            []
        );
        this.safeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            safeInterpretersKey,
            []
        );
        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.ResetUnsafePythonInterpretersList,
                this.resetUnsafeInterpreters.bind(this)
            )
        );
    }

    public async resetUnsafeInterpreters(): Promise<void> {
        this.activatedWorkspacesKeys.forEach(async key => {
            const areInterpretersInWorkspaceSafe = this.persistentStateFactory.createGlobalPersistentState<
                boolean | undefined
            >(key, undefined);
            await areInterpretersInWorkspaceSafe.updateValue(undefined);
        });
        await this.safeInterpreters.updateValue([]);
        await this.unsafeInterpreters.updateValue([]);
        await this.unsafeInterpreterPromptEnabled.updateValue(true);
    }

    public getKeyForWorkspace(resource: Uri): string {
        const key = `ARE_INTERPRETERS_SAFE_FOR_WS_${this.workspaceService.getWorkspaceFolderIdentifier(resource)}`;
        if (!this.activatedWorkspacesKeys.has(key)) {
            this.activatedWorkspacesKeys.add(key);
        }
        return key;
    }
}
