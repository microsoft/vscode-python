// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { CommandManager } from '../../../../../client/common/application/commandManager';
import { ICommandManager } from '../../../../../client/common/application/types';
import { Commands } from '../../../../../client/common/constants';
import { IDisposable } from '../../../../../client/common/types';
import { InterpreterPathCommand } from '../../../../../client/debugger/extension/configuration/launch.json/interpreterPathCommand';
import { IInterpreterService } from '../../../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../../../client/pythonEnvironments/info';

suite('Interpreter Path Command', () => {
    let cmdManager: ICommandManager;
    let interpreterService: IInterpreterService;
    let interpreterPathCommand: InterpreterPathCommand;
    setup(() => {
        cmdManager = mock(CommandManager);
        interpreterService = mock<IInterpreterService>();
        interpreterPathCommand = new InterpreterPathCommand(instance(cmdManager), instance(interpreterService), []);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Ensure command is registered with the correct callback handler', async () => {
        let getInterpreterPathHandler = (_param: unknown) => undefined;
        when(cmdManager.registerCommand(Commands.GetSelectedInterpreterPath, anything())).thenCall((_, cb) => {
            getInterpreterPathHandler = cb;
            return TypeMoq.Mock.ofType<IDisposable>().object;
        });

        await interpreterPathCommand.activate();

        verify(cmdManager.registerCommand(Commands.GetSelectedInterpreterPath, anything())).once();

        const getSelectedInterpreterPath = sinon.stub(InterpreterPathCommand.prototype, '_getSelectedInterpreterPath');
        getInterpreterPathHandler([]);
        assert(getSelectedInterpreterPath.calledOnceWith([]));
    });

    test('If `workspaceFolder` property exists in `args`, it is used to retrieve setting from config', async () => {
        const args = { workspaceFolder: 'folderPath' };
        when(interpreterService.getActiveInterpreter(anything())).thenCall((arg) => {
            assert.deepEqual(arg, Uri.parse('folderPath'));

            return Promise.resolve({ path: 'settingValue' }) as unknown;
        });
        const setting = await interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });

    test('If `args[1]` is defined, it is used to retrieve setting from config', async () => {
        const args = ['command', 'folderPath'];
        when(interpreterService.getActiveInterpreter(anything())).thenCall((arg) => {
            assert.deepEqual(arg, Uri.parse('folderPath'));

            return Promise.resolve({ path: 'settingValue' }) as unknown;
        });
        const setting = await interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });

    test('If neither of these exists, value of workspace folder is `undefined`', async () => {
        const args = ['command'];

        when(interpreterService.getActiveInterpreter(undefined)).thenReturn(
            Promise.resolve({ path: 'settingValue' }) as Promise<PythonEnvironment | undefined>,
        );
        const setting = await interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });

    test('If `args[1]` is not a valid uri', async () => {
        const args = ['command', '${input:some_input}'];
        when(interpreterService.getActiveInterpreter(anything())).thenCall((arg) => {
            assert.deepEqual(arg, undefined);
            return Promise.resolve({ path: 'settingValue' }) as unknown;
        });
        const setting = await interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });
});
