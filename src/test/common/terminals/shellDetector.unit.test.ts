// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import * as sinon from 'sinon';
import { instance, mock, when } from 'ts-mockito';
import { Terminal } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { CurrentProcess } from '../../../client/common/process/currentProcess';
import { ShellDetector } from '../../../client/common/terminal/shellDetector';
import { TerminalShellType } from '../../../client/common/terminal/types';
import { OSType } from '../../common';

// tslint:disable:max-func-body-length no-any

suite('Shell Detector', () => {
    let shellDetector: ShellDetector;
    let platformService: IPlatformService;
    let currentProcess: CurrentProcess;

    // Dummy data for testing.
    const shellPathsAndIdentification = new Map<string, TerminalShellType>();
    shellPathsAndIdentification.set('c:\\windows\\system32\\cmd.exe', TerminalShellType.commandPrompt);
    shellPathsAndIdentification.set('c:\\windows\\system32\\bash.exe', TerminalShellType.bash);
    shellPathsAndIdentification.set('c:\\windows\\system32\\wsl.exe', TerminalShellType.wsl);
    shellPathsAndIdentification.set('c:\\windows\\system32\\gitbash.exe', TerminalShellType.gitbash);
    shellPathsAndIdentification.set('/usr/bin/bash', TerminalShellType.bash);
    shellPathsAndIdentification.set('/usr/bin/zsh', TerminalShellType.zsh);
    shellPathsAndIdentification.set('/usr/bin/ksh', TerminalShellType.ksh);
    shellPathsAndIdentification.set('c:\\windows\\system32\\powershell.exe', TerminalShellType.powershell);
    shellPathsAndIdentification.set('c:\\windows\\system32\\pwsh.exe', TerminalShellType.powershellCore);
    shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/powershell', TerminalShellType.powershell);
    shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/pwsh', TerminalShellType.powershellCore);
    shellPathsAndIdentification.set('/usr/bin/fish', TerminalShellType.fish);
    shellPathsAndIdentification.set('c:\\windows\\system32\\shell.exe', TerminalShellType.other);
    shellPathsAndIdentification.set('/usr/bin/shell', TerminalShellType.other);
    shellPathsAndIdentification.set('/usr/bin/csh', TerminalShellType.cshell);
    shellPathsAndIdentification.set('/usr/bin/tcsh', TerminalShellType.tcshell);
    shellPathsAndIdentification.set('/usr/bin/xonsh', TerminalShellType.xonsh);
    shellPathsAndIdentification.set('/usr/bin/xonshx', TerminalShellType.other);


    setup(() => {
        platformService = mock(PlatformService);
        currentProcess = mock(CurrentProcess);
        shellDetector = new ShellDetector(instance(platformService),
            instance(currentProcess),
            instance(mock(WorkspaceService)));
    });
    test('Test identification of Terminal Shells', async () => {
        shellPathsAndIdentification.forEach((shellType, shellPath) => {
            expect(shellDetector.identifyShellByTerminalName(shellPath, {} as any)).to.equal(shellType, `Incorrect Shell Type from identifyShellByTerminalName, for path '${shellPath}'`);
            expect(shellDetector.identifyShellFromShellPath(shellPath)).to.equal(shellType, `Incorrect Shell Type for path from identifyTerminalFromShellPath, '${shellPath}'`);

            // Assume the same paths are stored in user settings, we should still be able to identify the shell.
            shellDetector.getTerminalShellPath = () => shellPath;
            expect(shellDetector.identifyShellFromSettings({} as any)).to.equal(shellType, `Incorrect Shell Type from identifyTerminalFromSettings, for path '${shellPath}'`);

            // Assume the same paths are defined in user environment variables, we should still be able to identify the shell.
            shellDetector.getDefaultPlatformShell = () => shellPath;
            expect(shellDetector.identifyShellFromUserEnv({} as any)).to.equal(shellType, `Incorrect Shell Type from identifyTerminalFromEnv, for path '${shellPath}'`);
        });
    });
    test('Default shell on Windows < 10 is cmd.exe', () => {
        when(platformService.osType).thenReturn(OSType.Windows);
        when(platformService.osRelease).thenReturn('7');
        when(currentProcess.env).thenReturn({});

        const shellPath = shellDetector.getDefaultPlatformShell();

        expect(shellPath).to.equal('cmd.exe');
    });
    test('Default shell on Windows >= 10 32bit is powershell.exe', () => {
        when(platformService.osType).thenReturn(OSType.Windows);
        when(platformService.osRelease).thenReturn('10');
        when(currentProcess.env).thenReturn({ windir: 'WindowsDir', PROCESSOR_ARCHITEW6432: '', comspec: 'hello.exe' });

        const shellPath = shellDetector.getDefaultPlatformShell();

        expect(shellPath).to.equal('WindowsDir\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe');
    });
    test('Default shell on Windows >= 10 64bit is powershell.exe', () => {
        when(platformService.osType).thenReturn(OSType.Windows);
        when(platformService.osRelease).thenReturn('10');
        when(currentProcess.env).thenReturn({ windir: 'WindowsDir', comspec: 'hello.exe' });

        const shellPath = shellDetector.getDefaultPlatformShell();

        expect(shellPath).to.equal('WindowsDir\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    });
    test('Default shell on Windows < 10 is what ever is defined in env.comspec', () => {
        when(platformService.osType).thenReturn(OSType.Windows);
        when(platformService.osRelease).thenReturn('7');
        when(currentProcess.env).thenReturn({ comspec: 'hello.exe' });

        const shellPath = shellDetector.getDefaultPlatformShell();

        expect(shellPath).to.equal('hello.exe');
    });
    [OSType.OSX, OSType.Linux].forEach((osType) => {
        test(`Default shell on ${osType} is /bin/bash`, () => {
            when(platformService.osType).thenReturn(OSType.OSX);
            when(currentProcess.env).thenReturn({});

            const shellPath = shellDetector.getDefaultPlatformShell();

            expect(shellPath).to.equal('/bin/bash');
        });
        test(`Default shell on ${osType} is what ever is in env.SHELL`, () => {
            when(platformService.osType).thenReturn(OSType.OSX);
            when(currentProcess.env).thenReturn({ SHELL: 'hello terminal.app' });

            const shellPath = shellDetector.getDefaultPlatformShell();

            expect(shellPath).to.equal('hello terminal.app');
        });
        test(`Default shell on ${osType} is what ever is /bin/bash if env.SHELL == /bin/false`, () => {
            when(platformService.osType).thenReturn(OSType.OSX);
            when(currentProcess.env).thenReturn({ SHELL: '/bin/false' });

            const shellPath = shellDetector.getDefaultPlatformShell();

            expect(shellPath).to.equal('/bin/bash');
        });
    });
    shellPathsAndIdentification.forEach((expectedShell, shellPath) => {
        if (expectedShell === TerminalShellType.other) {
            return;
        }
        const testSuffix = `(${shellPath})`;
        test(`Try identifying the shell based on the terminal name ${testSuffix}`, () => {
            const terminal: Terminal = { name: shellPath } as any;

            const identifyShellByTerminalName = sinon.stub(shellDetector, 'identifyShellByTerminalName');
            const getTerminalShellPath = sinon.stub(shellDetector, 'getTerminalShellPath');
            const getDefaultPlatformShell = sinon.stub(shellDetector, 'getDefaultPlatformShell');

            identifyShellByTerminalName.callsFake(() => expectedShell);

            const shell = shellDetector.identifyTerminalShell(terminal);

            expect(identifyShellByTerminalName.calledOnce).to.equal(true, 'identifyShellByTerminalName should be invoked to identify the shell');
            expect(identifyShellByTerminalName.args[0][0]).to.equal(terminal.name);
            expect(getTerminalShellPath.notCalled).to.equal(true, 'We should not be checking the shell path');
            expect(getDefaultPlatformShell.notCalled).to.equal(true, 'We should not be identifying the default OS shell');
            expect(shell).to.equal(expectedShell);
        });
        test(`Try identifying the shell based on VSC Settings ${testSuffix}`, () => {
            // As the terminal is 'some unknown value' we don't know the shell.
            // We should identify the shell based on VSC settings.
            // We should not check user environment for shell.
            const terminal: Terminal = { name: 'some unknown name' } as any;

            const identifyShellByTerminalName = sinon.stub(shellDetector, 'identifyShellByTerminalName');
            const getTerminalShellPath = sinon.stub(shellDetector, 'getTerminalShellPath');
            const getDefaultPlatformShell = sinon.stub(shellDetector, 'getDefaultPlatformShell');

            // We cannot identify shell by the name of the terminal, hence other will be returned.
            identifyShellByTerminalName.callsFake(() => TerminalShellType.other);
            getTerminalShellPath.returns(shellPath);

            const shell = shellDetector.identifyTerminalShell(terminal);

            expect(getTerminalShellPath.calledOnce).to.equal(true, 'We should be checking the shell path');
            expect(identifyShellByTerminalName.args[0][0]).to.equal(terminal.name);
            expect(getTerminalShellPath.calledAfter(identifyShellByTerminalName)).to.equal(true, 'We should be checking the shell path after checking terminal name');
            expect(getDefaultPlatformShell.calledOnce).to.equal(false, 'We should not be identifying the default OS shell');
            expect(identifyShellByTerminalName.calledOnce).to.equal(true, 'identifyShellByTerminalName should be invoked');
            expect(shell).to.equal(expectedShell);
        });
        test(`Try identifying the shell based on user environment ${testSuffix}`, () => {
            // As the terminal is 'some unknown value' we don't know the shell.
            // We should try try identify the shell based on VSC settings.
            // We should check user environment for shell.
            const terminal: Terminal = { name: 'some unknown name' } as any;

            const identifyShellByTerminalName = sinon.stub(shellDetector, 'identifyShellByTerminalName');
            const getTerminalShellPath = sinon.stub(shellDetector, 'getTerminalShellPath');
            const getDefaultPlatformShell = sinon.stub(shellDetector, 'getDefaultPlatformShell');

            // We cannot identify shell by the name of the terminal, hence other will be returned.
            identifyShellByTerminalName.callsFake(() => TerminalShellType.other);
            getTerminalShellPath.returns('some bogus terminal app.app');
            getDefaultPlatformShell.returns(shellPath);

            const shell = shellDetector.identifyTerminalShell(terminal);

            expect(getTerminalShellPath.calledOnce).to.equal(true, 'We should be checking the shell path');
            expect(identifyShellByTerminalName.args[0][0]).to.equal(terminal.name);
            expect(getTerminalShellPath.calledAfter(identifyShellByTerminalName)).to.equal(true, 'We should be checking the shell path after checking terminal name');
            expect(getDefaultPlatformShell.calledOnce).to.equal(true, 'We should be identifying the default OS shell');
            expect(getDefaultPlatformShell.calledAfter(getTerminalShellPath)).to.equal(true, 'We should be checking the platform shell path after checking settings');
            expect(identifyShellByTerminalName.calledOnce).to.equal(true, 'identifyShellByTerminalName should be invoked');
            expect(shell).to.equal(expectedShell);
        });
    });
    [OSType.Windows, OSType.Linux, OSType.OSX].forEach(osType => {
        test(`Use os defaults if all 3 stratergies fail (${osType})`, () => {
            // All three approaches should fail.
            // We should try try identify the shell based on VSC settings.
            // We should check user environment for shell.
            const terminal: Terminal = { name: 'some unknown name' } as any;
            const expectedDefault = osType === OSType.Windows ? TerminalShellType.commandPrompt : TerminalShellType.bash;

            const identifyShellByTerminalName = sinon.stub(shellDetector, 'identifyShellByTerminalName');
            const getTerminalShellPath = sinon.stub(shellDetector, 'getTerminalShellPath');
            const getDefaultPlatformShell = sinon.stub(shellDetector, 'getDefaultPlatformShell');

            // Remember, none of the methods should return a valid terminal.
            when(platformService.osType).thenReturn(osType);
            identifyShellByTerminalName.callsFake(() => TerminalShellType.other);
            getTerminalShellPath.returns('some bogus terminal app.app');
            getDefaultPlatformShell.returns('nothing here as well');

            const shell = shellDetector.identifyTerminalShell(terminal);

            expect(getTerminalShellPath.calledOnce).to.equal(true, 'We should be checking the shell path');
            expect(getDefaultPlatformShell.calledOnce).to.equal(true, 'We should be identifying the default OS shell');
            expect(identifyShellByTerminalName.calledOnce).to.equal(true, 'identifyShellByTerminalName should be invoked');
            expect(identifyShellByTerminalName.args[0][0]).to.equal(terminal.name);
            expect(shell).to.equal(expectedDefault);
        });
    });
});
