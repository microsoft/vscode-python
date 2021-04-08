// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Memento } from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { ICommandManager } from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IDisposable, IPersistentStateFactory } from '../../client/common/types';
import { MockMemento } from '../mocks/mementos';

suite('Persistent State', () => {
    let cmdManager: TypeMoq.IMock<ICommandManager>;
    let persistentStateFactory: IPersistentStateFactory & IExtensionSingleActivationService;
    let workspaceMemento: Memento;
    let globalMemento: Memento;
    setup(() => {
        cmdManager = TypeMoq.Mock.ofType<ICommandManager>();
        workspaceMemento = new MockMemento();
        globalMemento = new MockMemento();
        persistentStateFactory = new PersistentStateFactory(globalMemento, workspaceMemento, cmdManager.object);
    });

    test('Global states created are restored on invoking clean storage command', async () => {
        let clearStorageCommand: (() => Promise<void>) | undefined;
        cmdManager
            .setup((c) => c.registerCommand(Commands.ClearStorage, TypeMoq.It.isAny()))
            .callback((_, c) => {
                clearStorageCommand = c;
            })
            .returns(() => TypeMoq.Mock.ofType<IDisposable>().object);

        // Register command to clean storage
        await persistentStateFactory.activate();

        expect(clearStorageCommand).to.not.equal(undefined, 'Callback not registered');

        const globalKey1State = persistentStateFactory.createGlobalPersistentState('key1', 'defaultKey1Value');
        await globalKey1State.updateValue('key1Value');
        const globalKey2State = persistentStateFactory.createGlobalPersistentState<string | undefined>(
            'key2',
            undefined,
        );
        await globalKey2State.updateValue('key2Value');

        // Verify states are updated correctly
        expect(globalKey1State.value).to.equal('key1Value');
        expect(globalKey2State.value).to.equal('key2Value');

        await clearStorageCommand!(); // Invoke command

        // Verify states are now reset to their default value.
        expect(globalKey1State.value).to.equal('defaultKey1Value');
        expect(globalKey2State.value).to.equal(undefined);
    });

    test('Workspace states created are restored on invoking clean storage command', async () => {
        let clearStorageCommand: (() => Promise<void>) | undefined;
        cmdManager
            .setup((c) => c.registerCommand(Commands.ClearStorage, TypeMoq.It.isAny()))
            .callback((_, c) => {
                clearStorageCommand = c;
            })
            .returns(() => TypeMoq.Mock.ofType<IDisposable>().object);

        // Register command to clean storage
        await persistentStateFactory.activate();

        expect(clearStorageCommand).to.not.equal(undefined, 'Callback not registered');

        const workspaceKey1State = persistentStateFactory.createWorkspacePersistentState('key1');
        await workspaceKey1State.updateValue('key1Value');
        const workspaceKey2State = persistentStateFactory.createWorkspacePersistentState('key2', 'defaultKey2Value');
        await workspaceKey2State.updateValue('key2Value');

        // Verify states are updated correctly
        expect(workspaceKey1State.value).to.equal('key1Value');
        expect(workspaceKey2State.value).to.equal('key2Value');

        await clearStorageCommand!(); // Invoke command

        // Verify states are now reset to their default value.
        expect(workspaceKey1State.value).to.equal(undefined);
        expect(workspaceKey2State.value).to.equal('defaultKey2Value');
    });
});
