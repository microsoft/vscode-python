// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as Typemoq from 'typemoq';
import { Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { Commands } from '../../../../client/common/constants';
import { IDisposable, IPersistentState, IPersistentStateFactory } from '../../../../client/common/types';
import {
    flaggedWorkspacesKeysStorageKey,
    safeInterpretersKey,
    unsafeInterpreterPromptKey,
    unsafeInterpretersKey
} from '../../../../client/interpreter/autoSelection/constants';
import { InterpreterSecurityStorage } from '../../../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityStorage';

suite('Interpreter Security Storage', () => {
    const resource = Uri.parse('a');
    let persistentStateFactory: Typemoq.IMock<IPersistentStateFactory>;
    let interpreterSecurityStorage: InterpreterSecurityStorage;
    let unsafeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let safeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let flaggedWorkspacesKeysStorage: Typemoq.IMock<IPersistentState<string[]>>;
    let commandManager: Typemoq.IMock<ICommandManager>;
    let workspaceService: Typemoq.IMock<IWorkspaceService>;
    let areInterpretersInWorkspaceSafe: Typemoq.IMock<IPersistentState<boolean | undefined>>;
    let unsafeInterpreterPromptEnabled: Typemoq.IMock<IPersistentState<boolean>>;
    setup(() => {
        persistentStateFactory = Typemoq.Mock.ofType<IPersistentStateFactory>();
        unsafeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        safeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        flaggedWorkspacesKeysStorage = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        unsafeInterpreterPromptEnabled = Typemoq.Mock.ofType<IPersistentState<boolean>>();
        commandManager = Typemoq.Mock.ofType<ICommandManager>();
        workspaceService = Typemoq.Mock.ofType<IWorkspaceService>();
        areInterpretersInWorkspaceSafe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<string[]>(unsafeInterpretersKey, []))
            .returns(() => unsafeInterpreters.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<string[]>(safeInterpretersKey, []))
            .returns(() => safeInterpreters.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState(unsafeInterpreterPromptKey, true))
            .returns(() => unsafeInterpreterPromptEnabled.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<string[]>(flaggedWorkspacesKeysStorageKey, []))
            .returns(() => flaggedWorkspacesKeysStorage.object);
        interpreterSecurityStorage = new InterpreterSecurityStorage(
            persistentStateFactory.object,
            workspaceService.object,
            commandManager.object,
            []
        );
    });

    test('Command is registered in the activate() method', async () => {
        commandManager
            .setup(c => c.registerCommand(Commands.ResetInterpreterSecurityStorage, Typemoq.It.isAny()))
            .returns(() => Typemoq.Mock.ofType<IDisposable>().object)
            .verifiable(Typemoq.Times.once());

        await interpreterSecurityStorage.activate();

        commandManager.verifyAll();
    });

    test('Flagged workspace keys are stored correctly', async () => {
        flaggedWorkspacesKeysStorage
            .setup(f => f.value)
            .returns(() => ['workspace1Key'])
            .verifiable(Typemoq.Times.once());
        const workspace2 = Uri.parse('2');
        workspaceService.setup(w => w.getWorkspaceFolderIdentifier(workspace2)).returns(() => workspace2.fsPath);

        const workspace2Key = interpreterSecurityStorage._getKeyForWorkspace(workspace2);

        flaggedWorkspacesKeysStorage
            .setup(f => f.updateValue(['workspace1Key', workspace2Key]))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());

        await interpreterSecurityStorage.storeKeyForWorkspace(workspace2);

        expect(workspace2Key).to.equal(`ARE_INTERPRETERS_SAFE_FOR_WS_${workspace2.fsPath}`);
    });

    test('All kinds of storages are cleared upon invoking the command', async () => {
        const areInterpretersInWorkspace1Safe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();
        const areInterpretersInWorkspace2Safe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();

        flaggedWorkspacesKeysStorage.setup(f => f.value).returns(() => ['workspace1Key', 'workspace2Key']);
        safeInterpreters
            .setup(s => s.updateValue([]))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());
        unsafeInterpreters
            .setup(s => s.updateValue([]))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());
        unsafeInterpreterPromptEnabled
            .setup(s => s.updateValue(true))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<boolean | undefined>('workspace1Key', undefined))
            .returns(() => areInterpretersInWorkspace1Safe.object);
        areInterpretersInWorkspace1Safe
            .setup(s => s.updateValue(undefined))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<boolean | undefined>('workspace2Key', undefined))
            .returns(() => areInterpretersInWorkspace2Safe.object);
        areInterpretersInWorkspace2Safe
            .setup(s => s.updateValue(undefined))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());

        await interpreterSecurityStorage.resetInterpreterSecurityStorage();

        areInterpretersInWorkspace1Safe.verifyAll();
        areInterpretersInWorkspace2Safe.verifyAll();
        safeInterpreters.verifyAll();
        unsafeInterpreterPromptEnabled.verifyAll();
        unsafeInterpreters.verifyAll();
    });

    test('Method areInterpretersInWorkspaceSafe() returns the areInterpretersInWorkspaceSafe storage', () => {
        workspaceService.setup(w => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup(p =>
                p.createGlobalPersistentState<boolean | undefined>(
                    `ARE_INTERPRETERS_SAFE_FOR_WS_${resource.fsPath}`,
                    undefined
                )
            )
            .returns(() => areInterpretersInWorkspaceSafe.object);
        const result = interpreterSecurityStorage.hasUserApprovedWorkspaceInterpreters(resource);
        assert(areInterpretersInWorkspaceSafe.object === result);
    });

    test('Get unsafeInterpreterPromptEnabled() returns the unsafeInterpreterPromptEnabled storage', () => {
        const result = interpreterSecurityStorage.unsafeInterpreterPromptEnabled;
        assert(unsafeInterpreterPromptEnabled.object === result);
    });

    test('Get unsafeInterpreters() returns the unsafeInterpreters storage', () => {
        const result = interpreterSecurityStorage.unsafeInterpreters;
        assert(unsafeInterpreters.object === result);
    });

    test('Get safeInterpreters() returns the safeInterpreters storage', () => {
        const result = interpreterSecurityStorage.safeInterpreters;
        assert(safeInterpreters.object === result);
    });
});
