// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { CommandManager } from '../../../../../client/common/application/commandManager';
import { ICommandManager } from '../../../../../client/common/application/types';
import { Commands } from '../../../../../client/common/constants';
import { IDisposable } from '../../../../../client/common/types';
import { InterpreterPathCommand } from '../../../../../client/debugger/extension/configuration/launch.json/interpreterPathCommand';
import { IInterpreterDisplay } from '../../../../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../../../../client/interpreter/display';

suite('Interpreter Path Command', () => {
    let cmdManager: ICommandManager;
    let interpreterDisplay: IInterpreterDisplay;
    let interpreterPathCommand: InterpreterPathCommand;
    setup(() => {
        cmdManager = mock(CommandManager);
        interpreterDisplay = mock(InterpreterDisplay);
        interpreterPathCommand = new InterpreterPathCommand(instance(cmdManager), instance(interpreterDisplay), []);
    });

    test('Ensure command is registered with the correct callback handlers', async () => {
        let getInterpreterPathHandler!: Function;
        when(cmdManager.registerCommand(Commands.GetSelectedInterpreterPath, anything())).thenCall((_, cb) => {
            getInterpreterPathHandler = cb;
            return TypeMoq.Mock.ofType<IDisposable>().object;
        });

        await interpreterPathCommand.activate();

        when(interpreterDisplay.interpreterPath).thenResolve();
        getInterpreterPathHandler();
        verify(interpreterDisplay.interpreterPath).once();

        verify(cmdManager.registerCommand(Commands.GetSelectedInterpreterPath, anything())).once();
    });
});
