// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import rewiremock from 'rewiremock';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ICommandManager } from '../../../../client/common/application/types';
import { Commands } from '../../../../client/common/constants';
import { ITerminalService, ITerminalServiceFactory } from '../../../../client/common/terminal/types';
import { IDisposable } from '../../../../client/common/types';
import { InstallPythonViaTerminal } from '../../../../client/interpreter/configuration/interpreterSelector/commands/installPython/installPythonViaTerminal';

suite('Install Python via Terminal', () => {
    let cmdManager: ICommandManager;
    let terminalServiceFactory: ITerminalServiceFactory;
    let installPythonCommand: InstallPythonViaTerminal;
    let terminalService: ITerminalService;
    setup(() => {
        rewiremock.enable();
        cmdManager = mock<ICommandManager>();
        terminalServiceFactory = mock<ITerminalServiceFactory>();
        terminalService = mock<ITerminalService>();
        when(terminalServiceFactory.getTerminalService(anything())).thenReturn(instance(terminalService));
        installPythonCommand = new InstallPythonViaTerminal(instance(cmdManager), instance(terminalServiceFactory), []);
    });

    teardown(() => {
        rewiremock.disable();
        sinon.restore();
    });

    test('Sends expected commands when InstallPythonOnLinux command is executed if no dnf is available', async () => {
        let installCommandHandler: () => Promise<void>;
        when(cmdManager.registerCommand(Commands.InstallPythonOnLinux, anything())).thenCall((_, cb) => {
            installCommandHandler = cb;
            return TypeMoq.Mock.ofType<IDisposable>().object;
        });
        await installPythonCommand.activate();
        when(terminalService.sendText('sudo apt-get update')).thenResolve();
        when(terminalService.sendText('sudo apt-get install python3 python3-venv python3-pip')).thenResolve();

        await installCommandHandler!();

        verify(terminalService.sendText('sudo apt-get update')).once();
        verify(terminalService.sendText('sudo apt-get install python3 python3-venv python3-pip')).once();
    });

    test('Sends expected commands when InstallPythonOnLinux command is executed if dnf is available', async () => {
        let installCommandHandler: () => Promise<void>;
        when(cmdManager.registerCommand(Commands.InstallPythonOnLinux, anything())).thenCall((_, cb) => {
            installCommandHandler = cb;
            return TypeMoq.Mock.ofType<IDisposable>().object;
        });
        rewiremock('which').with((cmd: string) => {
            if (cmd === 'dnf') {
                return 'path/to/dnf';
            }
            throw new Error('Command not found');
        });

        await installPythonCommand.activate();
        when(terminalService.sendText('sudo dnf install python3')).thenResolve();

        await installCommandHandler!();

        verify(terminalService.sendText('sudo dnf install python3')).once();
    });

    test('Sends expected commands on Mac when InstallPythonOnMac command is executed if no dnf is available', async () => {
        let installCommandHandler: () => Promise<void>;
        when(cmdManager.registerCommand(Commands.InstallPythonOnMac, anything())).thenCall((_, cb) => {
            installCommandHandler = cb;
            return TypeMoq.Mock.ofType<IDisposable>().object;
        });
        await installPythonCommand.activate();
        when(terminalService.sendText('brew install python3')).thenResolve();

        await installCommandHandler!();

        verify(terminalService.sendText('brew install python3')).once();
    });
});
