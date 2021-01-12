// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import { Commands } from '../../../common/constants';
import { IDisposable, IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../../../common/types';
import {
    flaggedWorkspacesKeysStorageKey,
    safeInterpretersKey,
    unsafeInterpreterPromptKey,
    unsafeInterpretersKey,
} from '../constants';
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
    private flaggedWorkspacesKeysStorage: IPersistentState<string[]>;

    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[],
    ) {
        this._unsafeInterpreterPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            unsafeInterpreterPromptKey,
            true,
        );
        this._unsafeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            unsafeInterpretersKey,
            [],
        );
        this._safeInterpreters = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            safeInterpretersKey,
            [],
        );
        this.flaggedWorkspacesKeysStorage = this.persistentStateFactory.createGlobalPersistentState<string[]>(
            flaggedWorkspacesKeysStorageKey,
            [],
        );
    }

    public hasUserApprovedWorkspaceInterpreters(resource: Uri): IPersistentState<boolean | undefined> {
        return this.persistentStateFactory.createGlobalPersistentState<boolean | undefined>(
            this._getKeyForWorkspace(resource),
            undefined,
        );
    }

    public async activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.ResetInterpreterSecurityStorage,
                this.resetInterpreterSecurityStorage.bind(this),
            ),
        );
    }

    public async resetInterpreterSecurityStorage(): Promise<void> {
        this.flaggedWorkspacesKeysStorage.value.forEach(async (key) => {
            const areInterpretersInWorkspaceSafe = this.persistentStateFactory.createGlobalPersistentState<
                boolean | undefined
            >(key, undefined);
            await areInterpretersInWorkspaceSafe.updateValue(undefined);
        });
        await this.flaggedWorkspacesKeysStorage.updateValue([]);
        await this._safeInterpreters.updateValue([]);
        await this._unsafeInterpreters.updateValue([]);
        await this._unsafeInterpreterPromptEnabled.updateValue(true);
    }

    public _getKeyForWorkspace(resource: Uri): string {
        return `ARE_INTERPRETERS_SAFE_FOR_WS_${this.workspaceService.getWorkspaceFolderIdentifier(resource)}`;
    }

    public async storeKeyForWorkspace(resource: Uri): Promise<void> {
        const key = this._getKeyForWorkspace(resource);
        const flaggedWorkspacesKeys = this.flaggedWorkspacesKeysStorage.value;
        if (!flaggedWorkspacesKeys.includes(key)) {
            await this.flaggedWorkspacesKeysStorage.updateValue([key, ...flaggedWorkspacesKeys]);
        }
    }
}
