// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../../client/common/application/types';
import { Commands } from '../../../../client/common/constants';
import { IDisposableRegistry } from '../../../../client/common/types';
import { BaseAttachProcessProvider } from '../../../../client/debugger/extension/attachQuickPick/baseProvider';
import { IAttachItem } from '../../../../client/debugger/extension/attachQuickPick/types';

class TestProcessProvider extends BaseAttachProcessProvider {
    public async _getInternalProcessEntries(): Promise<IAttachItem[]> {
        return new Promise<IAttachItem[]>(resolve => {
            const items: IAttachItem[] = [
                {
                    label: 'syslogd',
                    description: '41',
                    detail: 'syslogd',
                    id: '41'
                },
                {
                    label: 'launchd',
                    description: '61',
                    detail: 'launchd',
                    id: '61'
                },
                {
                    label: 'python',
                    description: '31896',
                    detail: 'python script.py',
                    id: '31896'
                }
            ];
            resolve(items);
        });
    }
}

class TestProcessSameNameProvider extends TestProcessProvider {
    public async _getInternalProcessEntries(): Promise<IAttachItem[]> {
        return new Promise<IAttachItem[]>(resolve => {
            const items: IAttachItem[] = [
                {
                    label: 'launchd',
                    description: '562',
                    detail: 'launchd',
                    id: '562'
                },
                {
                    label: 'syslogd',
                    description: '41',
                    detail: 'syslogd',
                    id: '41'
                },
                {
                    label: 'launchd',
                    description: '61',
                    detail: 'launchd',
                    id: '61'
                },
                {
                    label: 'python',
                    description: '31896',
                    detail: 'python script.py',
                    id: '31896'
                }
            ];
            resolve(items);
        });
    }
}

suite('Attach to process - base process provider', () => {
    let applicationShell: IApplicationShell;
    let commandManager: ICommandManager;
    let disposableRegistry: IDisposableRegistry;
    let disposable: Disposable;

    let provider: TestProcessProvider;

    setup(() => {
        disposable = mock(Disposable);
        applicationShell = mock(ApplicationShell);

        commandManager = mock(CommandManager);
        when(commandManager.registerCommand(Commands.PickLocalProcess, anything(), anything())).thenReturn(instance(disposable));

        disposableRegistry = [];

        provider = new TestProcessProvider(instance(applicationShell), instance(commandManager), disposableRegistry);
    });

    teardown(() => {
        (disposableRegistry as Disposable[]).forEach(d => d.dispose());
    });

    test('Registering the picker command should not fail', () => {
        provider.registerCommands();

        verify(commandManager.registerCommand(Commands.PickLocalProcess, anything(), anything())).once();
        assert.strictEqual((disposableRegistry as []).length, 1);
    });

    test('Items returned by getAttachItems should be sorted alphabetically', async () => {
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '61',
                detail: 'launchd',
                id: '61'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            }
        ];

        const output = await provider.getAttachItems();

        assert.deepEqual(output, expectedOutput);
    });

    test('Items returned by getAttachItems with same process names should not be sorted', async () => {
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '562',
                detail: 'launchd',
                id: '562'
            },
            {
                label: 'launchd',
                description: '61',
                detail: 'launchd',
                id: '61'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            }
        ];

        provider = new TestProcessSameNameProvider(instance(applicationShell), instance(commandManager), disposableRegistry);
        const output = await provider.getAttachItems();

        assert.deepEqual(output, expectedOutput);
    });

});
