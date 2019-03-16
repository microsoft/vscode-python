// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';

import { TerminalManager } from '../../../client/common/application/terminalManager';
import { ITerminalManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { Bash } from '../../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../../client/common/terminal/environmentActivationProviders/commandPrompt';
import {
    CondaActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import {
    PipEnvActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import {
    PyEnvActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import {
    ITerminalActivationCommandProvider,
    ITerminalHelper,
    TerminalShellType
} from '../../../client/common/terminal/types';
import { IConfigurationService } from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { Architecture, OSType } from '../../../client/common/utils/platform';
import { ICondaService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';

// tslint:disable:max-func-body-length no-any

suite('Terminal Service helpers', () => {
    let helper: ITerminalHelper;
    let terminalManager: ITerminalManager;
    let platformService: IPlatformService;
    let workspaceService: IWorkspaceService;
    let condaService: ICondaService;
    let configurationService: IConfigurationService;
    let condaActivationProvider: ITerminalActivationCommandProvider;
    let bashActivationProvider: ITerminalActivationCommandProvider;
    let cmdActivationProvider: ITerminalActivationCommandProvider;
    let pyenvActivationProvider: ITerminalActivationCommandProvider;
    let pipenvActivationProvider: ITerminalActivationCommandProvider;
    let pythonSettings: PythonSettings;

    const pythonInterpreter: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64
    };

    function doSetup() {
        terminalManager = mock(TerminalManager);
        platformService = mock(PlatformService);
        workspaceService = mock(WorkspaceService);
        condaService = mock(CondaService);
        configurationService = mock(ConfigurationService);
        condaActivationProvider = mock(CondaActivationCommandProvider);
        bashActivationProvider = mock(Bash);
        cmdActivationProvider = mock(CommandPromptAndPowerShell);
        pyenvActivationProvider = mock(PyEnvActivationCommandProvider);
        pipenvActivationProvider = mock(PipEnvActivationCommandProvider);
        pythonSettings = mock(PythonSettings);

        helper = new TerminalHelper(instance(platformService), instance(terminalManager),
            instance(workspaceService),
            instance(condaService),
            instance(mock(InterpreterService)),
            instance(configurationService),
            instance(condaActivationProvider),
            instance(bashActivationProvider),
            instance(cmdActivationProvider),
            instance(pyenvActivationProvider),
            instance(pipenvActivationProvider));
    }
    suite('Misc', () => {
        setup(doSetup);

        test('Create terminal without a title', () => {
            const terminal = 'Terminal Created';
            when(terminalManager.createTerminal(anything())).thenReturn(terminal as any);

            const term = helper.createTerminal();

            verify(terminalManager.createTerminal(anything())).once();
            const args = capture(terminalManager.createTerminal).first()[0];
            expect(term).to.be.deep.equal(terminal);
            expect(args.name).to.be.deep.equal(undefined, 'name should be undefined');
        });
        test('Create terminal with a title', () => {
            const theTitle = 'Hello';
            const terminal = 'Terminal Created';
            when(terminalManager.createTerminal(anything())).thenReturn(terminal as any);

            const term = helper.createTerminal(theTitle);

            verify(terminalManager.createTerminal(anything())).once();
            const args = capture(terminalManager.createTerminal).first()[0];
            expect(term).to.be.deep.equal(terminal);
            expect(args.name).to.be.deep.equal(theTitle);
        });
        test('Test identification of Terminal Shells', async () => {
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

            shellPathsAndIdentification.forEach((shellType, shellPath) => {
                expect(helper.identifyTerminalShell(shellPath)).to.equal(shellType, `Incorrect Shell Type for path '${shellPath}'`);
            });
        });
        async function ensurePathForShellIsCorrectlyRetrievedFromSettings(osType: OSType, expectedShellPath: string) {
            when(platformService.osType).thenReturn(osType);
            const cfgSetting = osType === OSType.Windows ? 'windows' : (osType === OSType.OSX ? 'osx' : 'linux');
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            const invocationCount = osType === OSType.Unknown ? 0 : 1;
            workspaceConfig
                .setup(w => w.get(TypeMoq.It.isValue(cfgSetting)))
                .returns(() => expectedShellPath)
                .verifiable(TypeMoq.Times.exactly(invocationCount));
            when(workspaceService.getConfiguration('terminal.integrated.shell')).thenReturn(workspaceConfig.object);

            const shellPath = helper.getTerminalShellPath();

            workspaceConfig.verifyAll();
            expect(shellPath).to.equal(expectedShellPath, 'Incorrect path for Osx');
        }
        test('Ensure path for shell is correctly retrieved from settings (osx)', async () => {
            await ensurePathForShellIsCorrectlyRetrievedFromSettings(OSType.OSX, 'abcd');
        });
        test('Ensure path for shell is correctly retrieved from settings (linux)', async () => {
            await ensurePathForShellIsCorrectlyRetrievedFromSettings(OSType.Linux, 'abcd');
        });
        test('Ensure path for shell is correctly retrieved from settings (windows)', async () => {
            await ensurePathForShellIsCorrectlyRetrievedFromSettings(OSType.Windows, 'abcd');
        });
        test('Ensure path for shell is correctly retrieved from settings (unknown os)', async () => {
            await ensurePathForShellIsCorrectlyRetrievedFromSettings(OSType.Unknown, '');
        });
        test('Ensure spaces in command is quoted', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'c:\\python 3.7.exe';
                const args = ['1', '2'];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()} 1 2`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
            });
        });

        test('Ensure empty args are ignored', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'python3.7.exe';
                const args: string[] = [];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command}`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell '${item.name}'`);
            });
        });

        test('Ensure empty args are ignored with s in command', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'c:\\python 3.7.exe';
                const args: string[] = [];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()}`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
            });
        });
    });

    function title(resource?: Uri, interpreter?: PythonInterpreter) {
        return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
    }

    suite('Activation', () => {
        [undefined, Uri.parse('a')].forEach(resource => {
            suite(title(resource), () => {
                setup(() => {
                    doSetup();
                    when(configurationService.getSettings(resource)).thenReturn(instance(pythonSettings));
                });
                test('Activation command must be empty if activation of terminals is disabled', async () => {
                    when(pythonSettings.terminal).thenReturn({ activateEnvironment: false } as any);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.equal(undefined, 'Command must be undefined');
                    verify(pythonSettings.terminal).once();
                });
                function ensureCondaIsSupported(isSupported: boolean, pythonPath: string, condaActivationCommands: string[]) {
                    when(pythonSettings.pythonPath).thenReturn(pythonPath);
                    when(pythonSettings.terminal).thenReturn({ activateEnvironment: true } as any);
                    when(condaService.isCondaEnvironment(pythonPath)).thenResolve(isSupported);
                    when(condaActivationProvider.getActivationCommands(resource, anything())).thenResolve(condaActivationCommands);
                }
                test('Activation command must return conda activation command if interpreter is conda', async () => {
                    const pythonPath = 'some python Path value';
                    const condaActivationCommands = ['Hello', '1'];
                    ensureCondaIsSupported(true, pythonPath, condaActivationCommands);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.equal(condaActivationCommands);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(condaActivationProvider.getActivationCommands(resource, anything())).once();
                });
                test('Activation command must return undefined if none of the proivders support the shell', async () => {
                    const pythonPath = 'some python Path value';
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands('someShell' as any as TerminalShellType, resource);

                    expect(cmd).to.equal(undefined, 'Command must be undefined');
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from bash if that is supported and others are not', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(bashActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from pipenv if that is supported and even if others are supported', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(pipenvActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(true);

                    [bashActivationProvider, cmdActivationProvider, pyenvActivationProvider].forEach(provider => {
                        when(provider.getActivationCommands(resource, anything())).thenResolve(['Something']);
                        when(provider.isShellSupported(anything())).thenReturn(true);
                    });

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).never();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.getActivationCommands(resource, anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from Command Prompt if that is supported and others are not', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(cmdActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from Command Prompt if that is supported, and so is bash but no commands are returned', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(cmdActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);
                    when(bashActivationProvider.getActivationCommands(resource, anything())).thenResolve([]);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(cmdActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                [undefined, pythonInterpreter].forEach(interpreter => {
                    test('Activation command for Shell must be empty for unknown os', async () => {
                        const pythonPath = 'some python Path value';
                        ensureCondaIsSupported(false, pythonPath, []);

                        when(platformService.osType).thenReturn(OSType.Unknown);
                        when(bashActivationProvider.isShellSupported(anything())).thenReturn(false);
                        when(cmdActivationProvider.isShellSupported(anything())).thenReturn(false);

                        const cmd = await helper.getEnvironmentActivationShellCommands(resource, interpreter);

                        expect(cmd).to.equal(undefined, 'Command must be undefined');
                        verify(pythonSettings.terminal).never();
                        verify(pythonSettings.pythonPath).never();
                        verify(condaService.isCondaEnvironment(pythonPath)).never();
                        verify(bashActivationProvider.isShellSupported(anything())).never();
                        verify(pyenvActivationProvider.isShellSupported(anything())).never();
                        verify(pipenvActivationProvider.isShellSupported(anything())).never();
                        verify(cmdActivationProvider.isShellSupported(anything())).never();
                    });
                });
                [undefined, pythonInterpreter].forEach(interpreter => {
                    [OSType.Linux, OSType.OSX, OSType.Windows].forEach(osType => {
                        test(`Activation command for Shell must never use pipenv nor pyenv (${osType})`, async () => {
                            const pythonPath = 'some python Path value';
                            const shellToExpect = osType === OSType.Windows ? TerminalShellType.commandPrompt : TerminalShellType.bash;
                            ensureCondaIsSupported(false, pythonPath, []);

                            when(platformService.osType).thenReturn(osType);
                            when(bashActivationProvider.isShellSupported(shellToExpect)).thenReturn(false);
                            when(cmdActivationProvider.isShellSupported(shellToExpect)).thenReturn(false);

                            const cmd = await helper.getEnvironmentActivationShellCommands(resource, interpreter);

                            expect(cmd).to.equal(undefined, 'Command must be undefined');
                            verify(pythonSettings.terminal).once();
                            verify(pythonSettings.pythonPath).once();
                            verify(condaService.isCondaEnvironment(pythonPath)).once();
                            verify(bashActivationProvider.isShellSupported(shellToExpect)).atLeast(1);
                            verify(pyenvActivationProvider.isShellSupported(anything())).never();
                            verify(pipenvActivationProvider.isShellSupported(anything())).never();
                            verify(cmdActivationProvider.isShellSupported(shellToExpect)).atLeast(1);
                        });
                    });
                });
            });
        });
    });
});
