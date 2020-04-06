// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import { Commands } from '../../../common/constants';
import { IDisposable, IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../../../common/types';
import { safeInterpretersKey, unsafeInterpreterPromptKey, unsafeInterpretersKey } from '../constants';
import { IInterpreterSecurityStorage } from '../types';

@injectable()
export class InterpreterSecurityStorage implements IInterpreterSecurityStorage {
    public get unsafeInterpreterPromptEnabled(): IPersistentState<boolean> {
        return this._unsafeInterpreterPromptEnabled;
    }
    public get unsafeInterpreters(): IPersistentState<string[]> {
        return this._unsafeInterpreters;
    }
    public get safeInterpreters(): IPersistentState<string[]> {
        return this._safeInterpreters;
    }
    private _unsafeInterpreterPromptEnabled: IPersistentState<boolean>;
    private _unsafeInterpreters: IPersistentState<string[]>;
    private _safeInterpreters: IPersistentState<string[]>;
    private readonly activatedWorkspacesKeys = new Set<string>();

    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[]
    ) {
        this._unsafeInterpreterPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            unsafeInterpreterPromptKey,
            true
        );
        this._unsafeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            unsafeInterpretersKey,
            []
        );
        this._safeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            safeInterpretersKey,
            []
        );
    }

    public hasUserApprovedWorkspaceInterpreters(resource: Uri): IPersistentState<boolean | undefined> {
        return this.persistentStateFactory.createGlobalPersistentState<boolean | undefined>(
            this._getKeyForWorkspace(resource),
            undefined
        );
    }

    public async activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.ResetInterpreterSecurityStorage,
                this.resetInterpreterSecurityStorage.bind(this)
            )
        );
    }

    public async resetInterpreterSecurityStorage(): Promise<void> {
        this.activatedWorkspacesKeys.forEach(async key => {
            const areInterpretersInWorkspaceSafe = this.persistentStateFactory.createGlobalPersistentState<
                boolean | undefined
            >(key, undefined);
            await areInterpretersInWorkspaceSafe.updateValue(undefined);
        });
        await this._safeInterpreters.updateValue([]);
        await this._unsafeInterpreters.updateValue([]);
        await this._unsafeInterpreterPromptEnabled.updateValue(true);
    }

    public _getKeyForWorkspace(resource: Uri): string {
        const key = `ARE_INTERPRETERS_SAFE_FOR_WS_${this.workspaceService.getWorkspaceFolderIdentifier(resource)}`;
        if (!this.activatedWorkspacesKeys.has(key)) {
            this.activatedWorkspacesKeys.add(key);
        }
        return key;
    }
}
