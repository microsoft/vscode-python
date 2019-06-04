// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import { Terminal, Uri } from 'vscode';
import { ICondaService, IInterpreterService, InterpreterType, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITerminalManager } from '../application/types';
import '../extensions';
import { traceDecorators, traceError } from '../logger';
import { IPlatformService } from '../platform/types';
import { IConfigurationService, ICurrentProcess, Resource } from '../types';
import { OSType } from '../utils/platform';
import { ITerminalActivationCommandProvider, ITerminalHelper, TerminalActivationProviders, TerminalShellType } from './types';

// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_GITBASH = /(gitbash.exe$)/i;
const IS_BASH = /(bash.exe$|bash$)/i;
const IS_WSL = /(wsl.exe$)/i;
const IS_ZSH = /(zsh$)/i;
const IS_KSH = /(ksh$)/i;
const IS_COMMAND = /(cmd.exe$|cmd$)/i;
const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(csh$)/i;
const IS_TCSHELL = /(tcsh$)/i;
const IS_XONSH = /(xonsh$)/i;

const defaultOSShells = {
    [OSType.Linux]: TerminalShellType.bash,
    [OSType.OSX]: TerminalShellType.bash,
    [OSType.Windows]: TerminalShellType.commandPrompt,
    [OSType.Unknown]: undefined
};

@injectable()
export class TerminalHelper implements ITerminalHelper {
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(ITerminalActivationCommandProvider) @named(TerminalActivationProviders.conda) private readonly conda: ITerminalActivationCommandProvider,
        @inject(ITerminalActivationCommandProvider) @named(TerminalActivationProviders.bashCShellFish) private readonly bashCShellFish: ITerminalActivationCommandProvider,
        @inject(ITerminalActivationCommandProvider) @named(TerminalActivationProviders.commandPromptAndPowerShell) private readonly commandPromptAndPowerShell: ITerminalActivationCommandProvider,
        @inject(ITerminalActivationCommandProvider) @named(TerminalActivationProviders.pyenv) private readonly pyenv: ITerminalActivationCommandProvider,
        @inject(ITerminalActivationCommandProvider) @named(TerminalActivationProviders.pipenv) private readonly pipenv: ITerminalActivationCommandProvider,
        @inject(IConfigurationService) private readonly currentProcess: ICurrentProcess
    ) {
        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.gitbash, IS_GITBASH);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.wsl, IS_WSL);
        this.detectableShells.set(TerminalShellType.zsh, IS_ZSH);
        this.detectableShells.set(TerminalShellType.ksh, IS_KSH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);
        this.detectableShells.set(TerminalShellType.tcshell, IS_TCSHELL);
        this.detectableShells.set(TerminalShellType.cshell, IS_CSHELL);
        this.detectableShells.set(TerminalShellType.powershellCore, IS_POWERSHELL_CORE);
        this.detectableShells.set(TerminalShellType.xonsh, IS_XONSH);
    }
    public createTerminal(title?: string): Terminal {
        return this.terminalManager.createTerminal({ name: title });
    }
    public identifyTerminalShell(terminal?: Terminal): TerminalShellType {
        let shell = TerminalShellType.other;
        let usingDefaultShell = false;
        const terminalProvided = !!terminal;
        // Determine shell based on the name of the terminal.
        // See solution here https://github.com/microsoft/vscode/issues/74233#issuecomment-497527337
        if (terminal) {
            shell = this.identifyTerminalShellByName(terminal.name);
        }

        // If still unable to identify, then use fall back to determine path to the default shell.
        if (shell === TerminalShellType.other) {
            const shellPath = getDefaultShell(this.platform.osType, this.currentProcess);
            shell = Array.from(this.detectableShells.keys())
                .reduce((matchedShell, shellToDetect) => {
                    if (matchedShell === TerminalShellType.other && this.detectableShells.get(shellToDetect)!.test(shellPath)) {
                        return shellToDetect;
                    }
                    return matchedShell;
                }, TerminalShellType.other);

            // We have restored to using the default shell.
            usingDefaultShell = shell !== TerminalShellType.other;
        }
        const properties = { failed: shell === TerminalShellType.other, usingDefaultShell, terminalProvided };
        sendTelemetryEvent(EventName.TERMINAL_SHELL_IDENTIFICATION, undefined, properties);
        return shell;
    }
    public identifyTerminalShellByName(name: string): TerminalShellType {
        return Array.from(this.detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && this.detectableShells.get(shellToDetect)!.test(name)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);
    }

    public buildCommandForTerminal(terminalShellType: TerminalShellType, command: string, args: string[]) {
        const isPowershell = terminalShellType === TerminalShellType.powershell || terminalShellType === TerminalShellType.powershellCore;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${command.fileToCommandArgument()} ${args.join(' ')}`.trim();
    }
    public async getEnvironmentActivationCommands(terminalShellType: TerminalShellType, resource?: Uri): Promise<string[] | undefined> {
        const providers = [this.pipenv, this.pyenv, this.bashCShellFish, this.commandPromptAndPowerShell];
        const promise = this.getActivationCommands(resource || undefined, undefined, terminalShellType, providers);
        this.sendTelemetry(resource, terminalShellType, EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_TERMINAL, promise).ignoreErrors();
        return promise;
    }
    public async getEnvironmentActivationShellCommands(resource: Resource, interpreter?: PythonInterpreter): Promise<string[] | undefined> {
        const shell = defaultOSShells[this.platform.osType];
        if (!shell) {
            return;
        }
        const providers = [this.bashCShellFish, this.commandPromptAndPowerShell];
        const promise = this.getActivationCommands(resource, interpreter, shell, providers);
        this.sendTelemetry(resource, shell, EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_RUNNING_CODE, promise).ignoreErrors();
        return promise;
    }
    @traceDecorators.error('Failed to capture telemetry')
    protected async sendTelemetry(resource: Resource, terminalShellType: TerminalShellType, eventName: EventName, promise: Promise<string[] | undefined>): Promise<void> {
        let hasCommands = false;
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        let failed = false;
        try {
            const cmds = await promise;
            hasCommands = Array.isArray(cmds) && cmds.length > 0;
        } catch (ex) {
            failed = true;
            traceError('Failed to get activation commands', ex);
        }

        const pythonVersion = (interpreter && interpreter.version) ? interpreter.version.raw : undefined;
        const interpreterType = interpreter ? interpreter.type : InterpreterType.Unknown;
        const data = { failed, hasCommands, interpreterType, terminal: terminalShellType, pythonVersion };
        sendTelemetryEvent(eventName, undefined, data);
    }
    protected async getActivationCommands(resource: Resource, interpreter: PythonInterpreter | undefined, terminalShellType: TerminalShellType, providers: ITerminalActivationCommandProvider[]): Promise<string[] | undefined> {
        const settings = this.configurationService.getSettings(resource);
        const activateEnvironment = settings.terminal.activateEnvironment;
        if (!activateEnvironment) {
            return;
        }

        // If we have a conda environment, then use that.
        const isCondaEnvironment = await this.condaService.isCondaEnvironment(settings.pythonPath);
        if (isCondaEnvironment) {

            const activationCommands = interpreter ?
                await this.conda.getActivationCommandsForInterpreter(interpreter.path, terminalShellType) :
                await this.conda.getActivationCommands(resource, terminalShellType);

            if (Array.isArray(activationCommands)) {
                return activationCommands;
            }
        }

        // Search from the list of providers.
        const supportedProviders = providers.filter(provider => provider.isShellSupported(terminalShellType));

        for (const provider of supportedProviders) {

            const activationCommands = interpreter ?
                await provider.getActivationCommandsForInterpreter(interpreter.path, terminalShellType) :
                await provider.getActivationCommands(resource, terminalShellType);

            if (Array.isArray(activationCommands) && activationCommands.length > 0) {
                return activationCommands;
            }
        }
    }
}

/*
 The following code is based on VS Code from https://github.com/microsoft/vscode/blob/5c65d9bfa4c56538150d7f3066318e0db2c6151f/src/vs/workbench/contrib/terminal/node/terminal.ts#L12-L55
 This is only a fall back to identify the default shell used by VSC.
 On Windows, determine the default shell.
 On others, default to bash.
*/
function getDefaultShell(osType: OSType, currentProcess: ICurrentProcess): string {
    if (osType === OSType.Windows) {
        return getTerminalDefaultShellWindows(osType, currentProcess);
    }
    return '/bin/bash';
}
let _TERMINAL_DEFAULT_SHELL_WINDOWS: string | null = null;
function getTerminalDefaultShellWindows(osType: OSType, currentProcess: ICurrentProcess): string {
    if (!_TERMINAL_DEFAULT_SHELL_WINDOWS) {
        const isAtLeastWindows10 = osType === OSType.Windows && parseFloat(os.release()) >= 10;
        const is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
        const powerShellPath = `${process.env.windir}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}\\WindowsPowerShell\\v1.0\\powershell.exe`;
        _TERMINAL_DEFAULT_SHELL_WINDOWS = isAtLeastWindows10 ? powerShellPath : getWindowsShell(currentProcess);
    }
    return _TERMINAL_DEFAULT_SHELL_WINDOWS;
}

function getWindowsShell(currentProcess: ICurrentProcess): string {
    return currentProcess.env.comspec || 'cmd.exe';
}
