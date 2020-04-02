// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as Typemoq from 'typemoq';
import { Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { Commands } from '../../../../client/common/constants';
import { IDisposable, IPersistentState, IPersistentStateFactory } from '../../../../client/common/types';
import {
    safeInterpretersKey,
    unsafeInterpreterPromptKey,
    unsafeInterpretersKey
} from '../../../../client/interpreter/autoSelection/constants';
import { InterpreterSecurityCommands } from '../../../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityCommands';

suite('Interpreter Security commands', () => {
    let persistentStateFactory: Typemoq.IMock<IPersistentStateFactory>;
    let interpreterSecurityCommands: InterpreterSecurityCommands;
    let unsafeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let safeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let commandManager: Typemoq.IMock<ICommandManager>;
    let workspaceService: Typemoq.IMock<IWorkspaceService>;
    let unsafeInterpreterPromptEnabled: Typemoq.IMock<IPersistentState<boolean>>;
    setup(() => {
        persistentStateFactory = Typemoq.Mock.ofType<IPersistentStateFactory>();
        unsafeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        safeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        unsafeInterpreterPromptEnabled = Typemoq.Mock.ofType<IPersistentState<boolean>>();
        commandManager = Typemoq.Mock.ofType<ICommandManager>();
        workspaceService = Typemoq.Mock.ofType<IWorkspaceService>();
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<string[]>(unsafeInterpretersKey, []))
            .returns(() => unsafeInterpreters.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<string[]>(safeInterpretersKey, []))
            .returns(() => safeInterpreters.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState(unsafeInterpreterPromptKey, true))
            .returns(() => unsafeInterpreterPromptEnabled.object);
        commandManager
            .setup(c => c.registerCommand(Commands.ResetUnsafePythonInterpretersList, Typemoq.It.isAny()))
            .returns(() => Typemoq.Mock.ofType<IDisposable>().object);
    });

    test('Command is registered in the constructor', async () => {
        commandManager.reset();
        commandManager
            .setup(c => c.registerCommand(Commands.ResetUnsafePythonInterpretersList, Typemoq.It.isAny()))
            .returns(() => Typemoq.Mock.ofType<IDisposable>().object)
            .verifiable(Typemoq.Times.once());

        interpreterSecurityCommands = new InterpreterSecurityCommands(
            persistentStateFactory.object,
            workspaceService.object,
            commandManager.object,
            []
        );

        commandManager.verifyAll();
    });

    test('Activated workspace keys are captured & all kinds of storages are cleared upon invoking the command', async () => {
        interpreterSecurityCommands = new InterpreterSecurityCommands(
            persistentStateFactory.object,
            workspaceService.object,
            commandManager.object,
            []
        );
        // Initialize storage for workspace1
        const workspace1 = Uri.parse('1');
        const areInterpretersInWorkspace1Safe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();
        workspaceService.setup(w => w.getWorkspaceFolderIdentifier(workspace1)).returns(() => workspace1.fsPath);
        const workspace1Key = interpreterSecurityCommands.getKeyForWorkspace(workspace1);
        expect(workspace1Key).to.equal(`ARE_INTERPRETERS_SAFE_FOR_WS_${workspace1.fsPath}`);

        // Initialize storage for workspace2
        const workspace2 = Uri.parse('2');
        const areInterpretersInWorkspace2Safe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();
        workspaceService.setup(w => w.getWorkspaceFolderIdentifier(workspace2)).returns(() => workspace2.fsPath);
        const workspace2Key = interpreterSecurityCommands.getKeyForWorkspace(workspace2);
        expect(workspace2Key).to.equal(`ARE_INTERPRETERS_SAFE_FOR_WS_${workspace2.fsPath}`);

        // Now verify that all storages are cleared
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
            .setup(p => p.createGlobalPersistentState<boolean | undefined>(workspace1Key, undefined))
            .returns(() => areInterpretersInWorkspace1Safe.object);
        areInterpretersInWorkspace1Safe
            .setup(s => s.updateValue(undefined))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState<boolean | undefined>(workspace2Key, undefined))
            .returns(() => areInterpretersInWorkspace2Safe.object);
        areInterpretersInWorkspace2Safe
            .setup(s => s.updateValue(undefined))
            .returns(() => Promise.resolve())
            .verifiable(Typemoq.Times.once());

        await interpreterSecurityCommands.resetUnsafeInterpreters();

        areInterpretersInWorkspace1Safe.verifyAll();
        areInterpretersInWorkspace2Safe.verifyAll();
        safeInterpreters.verifyAll();
        unsafeInterpreterPromptEnabled.verifyAll();
        unsafeInterpreters.verifyAll();
    });
});
