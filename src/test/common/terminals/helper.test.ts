// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { workspace } from 'vscode';
import { EnumEx } from '../../../client/common/enumUtils';
import { IPlatformService } from '../../../client/common/platform/types';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { TerminalShellType } from '../../../client/common/terminal/types';
import { initialize, IS_MULTI_ROOT_TEST } from '../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Helper', () => {
    suiteSetup(function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
            return;
        }
        return initialize();
    });

    test('Test identification of Terminal Shells', async () => {
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const helper = new TerminalHelper(platformService.object);
        const shellPathsAndIdentification = new Map<string, TerminalShellType>();
        shellPathsAndIdentification.set('c:\\windows\\system32\\cmd.exe', TerminalShellType.commandPrompt);

        shellPathsAndIdentification.set('c:\\windows\\system32\\bash.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('c:\\windows\\system32\\wsl.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('c:\\windows\\system32\\gitbash.exe', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/bash', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/zsh', TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/zsh', TerminalShellType.bash);

        shellPathsAndIdentification.set('c:\\windows\\system32\\powershell.exe', TerminalShellType.powershell);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/powershell', TerminalShellType.powershell);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/pwsh', TerminalShellType.powershell);

        shellPathsAndIdentification.set('/usr/bin/fish', TerminalShellType.fish);

        shellPathsAndIdentification.set('c:\\windows\\system32\\shell.exe', TerminalShellType.other);
        shellPathsAndIdentification.set('/usr/bin/shell', TerminalShellType.other);

        shellPathsAndIdentification.forEach((shellType, shellPath) => {
            expect(helper.identifyTerminalShell(shellPath)).to.equal(shellType, `Incorrect Shell Type for path '${shellPath}'`);
        });
    });

    test('Ensure path for shell is correctly retrieved from settings', async () => {
        const shellConfig = workspace.getConfiguration('terminal.integrated.shell');

        let platformService = TypeMoq.Mock.ofType<IPlatformService>();
        let helper = new TerminalHelper(platformService.object);
        platformService.setup(p => p.isWindows).returns(() => false);
        platformService.setup(p => p.isLinux).returns(() => false);
        platformService.setup(p => p.isMac).returns(() => true);
        expect(helper.getTerminalShellPath()).to.equal(shellConfig.get<string>('osx'), 'Incorrect path for Osx');

        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        helper = new TerminalHelper(platformService.object);
        platformService.setup(p => p.isWindows).returns(() => false);
        platformService.setup(p => p.isLinux).returns(() => true);
        platformService.setup(p => p.isMac).returns(() => false);
        expect(helper.getTerminalShellPath()).to.equal(shellConfig.get<string>('linux'), 'Incorrect path for Linux');

        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        helper = new TerminalHelper(platformService.object);
        platformService.setup(p => p.isWindows).returns(() => true);
        platformService.setup(p => p.isLinux).returns(() => false);
        platformService.setup(p => p.isMac).returns(() => false);
        expect(helper.getTerminalShellPath()).to.equal(shellConfig.get<string>('windows'), 'Incorrect path for Windows');
    });

    test('Ensure spaces in command is quoted', async () => {
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const helper = new TerminalHelper(platformService.object);
        EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
            const command = 'c:\\python 3.7.exe';
            const args = ['1', '2'];
            const commandPrefix = (item.value === TerminalShellType.powershell) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}"${command}" 1 2`;

            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
        });
    });

    test('Ensure a terminal is created', () => {
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const helper = new TerminalHelper(platformService.object);
        const terminal = helper.createTerminal('1234');
        expect(terminal).not.to.be.an('undefined', 'Terminal not created');
        terminal.dispose();
    });

    test('Ensure a terminal is created with the     provided title', () => {
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const helper = new TerminalHelper(platformService.object);
        const terminal = helper.createTerminal('1234');
        expect(terminal).not.to.be.an('undefined', 'Terminal not created');
        expect(terminal.name).to.equal('1234', 'Incorrect title');
        terminal.dispose();
    });
});
