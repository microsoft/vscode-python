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
import { ConfigurationService } from '../../../../../client/common/configuration/service';
import { Commands } from '../../../../../client/common/constants';
import { IConfigurationService, IDisposable } from '../../../../../client/common/types';
import { InterpreterPathCommand } from '../../../../../client/debugger/extension/configuration/launch.json/interpreterPathCommand';

suite('Interpreter Path Command', () => {
    let cmdManager: ICommandManager;
    let configService: IConfigurationService;
    let interpreterPathCommand: InterpreterPathCommand;
    setup(() => {
        cmdManager = mock(CommandManager);
        configService = mock(ConfigurationService);
        interpreterPathCommand = new InterpreterPathCommand(instance(cmdManager), instance(configService), []);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Ensure command is registered with the correct callback handler', async () => {
        let getInterpreterPathHandler!: Function;
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
        when(configService.getSettings(anything())).thenCall((arg) => {
            assert.deepEqual(arg, Uri.parse('folderPath'));
            // tslint:disable-next-line: no-any
            return { pythonPath: 'settingValue' } as any;
        });
        const setting = interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });

    test('If `args[1]` is defined, it is used to retrieve setting from config', async () => {
        const args = ['command', 'folderPath'];
        when(configService.getSettings(anything())).thenCall((arg) => {
            assert.deepEqual(arg, Uri.parse('folderPath'));
            // tslint:disable-next-line: no-any
            return { pythonPath: 'settingValue' } as any;
        });
        const setting = interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });

    test('If neither of these exists, value of workspace folder is `undefined`', async () => {
        const args = ['command'];
        // tslint:disable-next-line: no-any
        when(configService.getSettings(undefined)).thenReturn({ pythonPath: 'settingValue' } as any);
        const setting = interpreterPathCommand._getSelectedInterpreterPath(args);
        expect(setting).to.equal('settingValue');
    });
});
