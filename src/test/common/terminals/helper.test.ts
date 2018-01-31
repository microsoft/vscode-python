// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, WorkspaceConfiguration } from 'vscode';
import { ITerminalManager, IWorkspaceService } from '../../../client/common/application/types';
import { EnumEx } from '../../../client/common/enumUtils';
import { IPlatformService } from '../../../client/common/platform/types';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { ITerminalHelper, TerminalShellType } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service helpers', () => {
    let helper: ITerminalHelper;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let disposables: Disposable[] = [];
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;

    setup(() => {
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        disposables = [];

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(ITerminalManager)).returns(() => terminalManager.object);
        serviceContainer.setup(c => c.get(IPlatformService)).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(IDisposableRegistry)).returns(() => disposables);
        serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(IInterpreterService)).returns(() => interpreterService.object);

        helper = new TerminalHelper(serviceContainer.object);
    });
    teardown(() => {
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });

    test('Test identification of Terminal Shells', async () => {
        const shellPathsAndIdentification = new Map<string, TerminalShellType>();
        shellPathsAndIdentification.set('c:\\windows\\system32\\cmd.exe', TerminalShellType.commandPrompt);

        shellPathsAndIdentification.set('c:\\windows\\system32\\bash.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('c:\\windows\\system32\\wsl.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('c:\\windows\\system32\\gitbash.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/bash', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/zsh', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/ksh', TerminalShellType.bash);

        shellPathsAndIdentification.set('c:\\windows\\system32\\powershell.exe', TerminalShellType.powershell);
        shellPathsAndIdentification.set('c:\\windows\\system32\\pwsh.exe', TerminalShellType.powershellCore);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/powershell', TerminalShellType.powershell);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/pwsh', TerminalShellType.powershellCore);

        shellPathsAndIdentification.set('/usr/bin/fish', TerminalShellType.fish);

        shellPathsAndIdentification.set('c:\\windows\\system32\\shell.exe', TerminalShellType.other);
        shellPathsAndIdentification.set('/usr/bin/shell', TerminalShellType.other);

        shellPathsAndIdentification.set('/usr/bin/csh', TerminalShellType.cshell);

        shellPathsAndIdentification.forEach((shellType, shellPath) => {
            expect(helper.identifyTerminalShell(shellPath)).to.equal(shellType, `Incorrect Shell Type for path '${shellPath}'`);
        });
    });

    async function ensurePathForShellIsCorrectlyRetrievedFromSettings(os: 'windows' | 'osx' | 'linux', expectedShellPat: string) {
        const shellPath = 'abcd';
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('terminal.integrated.shell'))).returns(() => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            workspaceConfig.setup(c => c.get(os)).returns(() => shellPath);
            return workspaceConfig.object;
        });

        platformService.setup(p => p.isWindows).returns(() => os === 'windows');
        platformService.setup(p => p.isLinux).returns(() => os === 'linux');
        platformService.setup(p => p.isMac).returns(() => os === 'osx');
        expect(helper.getTerminalShellPath()).to.equal(shellPath, 'Incorrect path for Osx');
    }
    test('Ensure path for shell is correctly retrieved from settings (osx)', async () => {
        await ensurePathForShellIsCorrectlyRetrievedFromSettings('osx', 'abcd');
    });
    test('Ensure path for shell is correctly retrieved from settings (linux)', async () => {
        await ensurePathForShellIsCorrectlyRetrievedFromSettings('linux', 'abcd');
    });
    test('Ensure path for shell is correctly retrieved from settings (windows)', async () => {
        await ensurePathForShellIsCorrectlyRetrievedFromSettings('windows', 'abcd');
    });
    test('Ensure path for shell is correctly retrieved from settings (unknown os)', async () => {
        await ensurePathForShellIsCorrectlyRetrievedFromSettings('windows', '');
    });

    test('Ensure spaces in command is quoted', async () => {
        EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
            const command = 'c:\\python 3.7.exe';
            const args = ['1', '2'];
            const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}"${command}" 1 2`;

            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
        });
    });

    test('Ensure empty args are ignored', async () => {
        EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
            const command = 'python3.7.exe';
            const args = [];
            const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}${command}`;

            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell '${item.name}'`);
        });
    });

    test('Ensure empty args are ignored with s in command', async () => {
        EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
            const command = 'c:\\python 3.7.exe';
            const args = [];
            const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}"${command}"`;

            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
        });
    });

    test('Ensure a terminal is created (without a title)', () => {
        helper.createTerminal();
        terminalManager.verify(t => t.createTerminal(TypeMoq.It.isValue({ name: undefined })), TypeMoq.Times.once());
    });

    test('Ensure a terminal is created with the provided title', () => {
        helper.createTerminal('1234');
        terminalManager.verify(t => t.createTerminal(TypeMoq.It.isValue({ name: '1234' })), TypeMoq.Times.once());
    });
});
