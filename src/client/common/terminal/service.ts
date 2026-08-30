// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bug fix - Bash-VS Code path errors
import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';
import { CancellationToken, Disposable, Event, EventEmitter, Terminal, TerminalShellExecution } from 'vscode';
import '../../common/extensions';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITerminalAutoActivation } from '../../terminals/types';
import { IApplicationShell, ITerminalManager } from '../application/types';
import { _SCRIPTS_DIR } from '../process/internal/scripts/constants';
import { IConfigurationService, IDisposableRegistry } from '../types';
import {
    ITerminalActivator,
    ITerminalHelper,
    ITerminalService,
    TerminalCreationOptions,
    TerminalShellType,
} from './types';
import { traceVerbose } from '../../logging';
import { sleep } from '../utils/async';
import { useEnvExtension } from '../../envExt/api.internal';
import { ensureTerminalLegacy } from '../../envExt/api.legacy';

@injectable()
export class TerminalService implements ITerminalService, Disposable {
    private terminal?: Terminal;
    private terminalShellType!: TerminalShellType;
    private terminalClosed = new EventEmitter<void>();
    private terminalManager: ITerminalManager;
    private terminalHelper: ITerminalHelper;
    private terminalActivator: ITerminalActivator;
    private terminalAutoActivator: ITerminalAutoActivation;
    private applicationShell: IApplicationShell;
    private readonly executeCommandListeners: Set<Disposable> = new Set();
    private _terminalFirstLaunched: boolean = true;
    private pythonReplCommandQueue: string[] = [];
    private isReplReady: boolean = false;
    private replPromptListener?: Disposable;
    private replShellTypeListener?: Disposable;
    public get onDidCloseTerminal(): Event<void> {
        return this.terminalClosed.event.bind(this.terminalClosed);
    }

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        private readonly options?: TerminalCreationOptions,
    ) {
        const disposableRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        disposableRegistry.push(this);
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        this.terminalManager = this.serviceContainer.get<ITerminalManager>(ITerminalManager);
        this.terminalAutoActivator = this.serviceContainer.get<ITerminalAutoActivation>(ITerminalAutoActivation);
        this.applicationShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.terminalManager.onDidCloseTerminal(this.terminalCloseHandler, this, disposableRegistry);
        this.terminalActivator = this.serviceContainer.get<ITerminalActivator>(ITerminalActivator);
    }
    public dispose() {
        this.terminal?.dispose();
        this.disposeReplListener();

        if (this.executeCommandListeners && this.executeCommandListeners.size > 0) {
            this.executeCommandListeners.forEach((d) => {
                d?.dispose();
            });
        }
    }

    // fixed Path interpretation bug between Bash and VS Code
    // fixed Path interpretation bug between Bash and VS Code
    public async sendCommand(command: string, args: string[] = []): Promise<void> {
        await this.ensureTerminal(); // <-- ADD THIS: Ensures terminal is booted up
        
        if (!this.options?.hideFromUser) {
            this.terminal!.show(true);
        }

        // Fetch the terminal settings from VS Code
        const terminalSettings = vscode.workspace.getConfiguration('terminal.integrated');
        const defaultProfile = terminalSettings.get<string>('defaultProfile.windows') || '';

        // Check if the destination target is a Bash terminal
        const isBashShell = defaultProfile.toLowerCase().includes('bash') || 
                            command.toLowerCase().includes('bash.exe');

        let processedCommand = command;
        let processedArgs = [...args];

        // If running on Windows but targeting Git Bash, swap backslashes to forward slashes!
        if (process.platform === 'win32' && isBashShell) {
            // Fix the executable binary path
            processedCommand = processedCommand.replace(/\\/g, '/');
            processedCommand = processedCommand.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

            // Fix the script file paths being sent as arguments
            processedArgs = processedArgs.map(arg => {
                let safeArg = arg.replace(/\\/g, '/');
                safeArg = safeArg.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
                return safeArg;
            });
        }

        // Standard VS Code logic to stitch the command and arguments together
        const text = processedArgs.reduce((p, c) => `${p} "${c}"`, processedCommand);
        
        // Ship the cleanly escaped string to the terminal stream!
        this.terminal!.sendText(text, true);
    }



    /** @deprecated */
    public async sendText(text: string): Promise<void> {
        await this.ensureTerminal();
        if (!this.options?.hideFromUser) {
            this.terminal!.show(true);
        }
        this.terminal!.sendText(text);
    }
    public async executeCommand(
        commandLine: string,
        isPythonShell: boolean,
    ): Promise<TerminalShellExecution | undefined> {
        if (isPythonShell) {
            if (this.isReplReady) {
                this.terminal?.sendText(commandLine);
                traceVerbose(`Python REPL sendText: ${commandLine}`);
            } else {
                // Queue command to run once REPL is ready.
                this.pythonReplCommandQueue.push(commandLine);
                traceVerbose(`Python REPL queued command: ${commandLine}`);
                this.startReplListener();
            }
            return undefined;
        }

        // Non-REPL code execution
        return this.executeCommandInternal(commandLine);
    }

    private startReplListener(): void {
        if (this.replPromptListener || this.replShellTypeListener) {
            return;
        }

        this.replShellTypeListener = this.terminalManager.onDidChangeTerminalState((terminal) => {
            if (this.terminal && terminal === this.terminal) {
                if (terminal.state.shell == 'python') {
                    traceVerbose('Python REPL ready from terminal shell api');
                    this.onReplReady();
                }
            }
        });

        let terminalData = '';
        this.replPromptListener = this.applicationShell.onDidWriteTerminalData((e) => {
            if (this.terminal && e.terminal === this.terminal) {
                terminalData += e.data;
                if (/>>>\s*$/.test(terminalData)) {
                    traceVerbose('Python REPL ready, from >>> prompt detection');
                    this.onReplReady();
                }
            }
        });
    }

    private onReplReady(): void {
        if (this.isReplReady) {
            return;
        }
        this.isReplReady = true;
        this.flushReplQueue();
        this.disposeReplListener();
    }

    private disposeReplListener(): void {
        if (this.replPromptListener) {
            this.replPromptListener.dispose();
            this.replPromptListener = undefined;
        }
        if (this.replShellTypeListener) {
            this.replShellTypeListener.dispose();
            this.replShellTypeListener = undefined;
        }
    }

    private flushReplQueue(): void {
        while (this.pythonReplCommandQueue.length > 0) {
            const commandLine = this.pythonReplCommandQueue.shift();
            if (commandLine) {
                traceVerbose(`Executing queued REPL command: ${commandLine}`);
                this.terminal?.sendText(commandLine);
            }
        }
    }

    private async executeCommandInternal(commandLine: string): Promise<TerminalShellExecution | undefined> {
        const terminal = this.terminal;
        if (!terminal) {
            traceVerbose('Terminal not available, cannot execute command');
            return undefined;
        }

        if (!this.options?.hideFromUser) {
            terminal.show(true);
        }

        // If terminal was just launched, wait some time for shell integration to onDidChangeShellIntegration.
        if (!terminal.shellIntegration && this._terminalFirstLaunched) {
            this._terminalFirstLaunched = false;
            const promise = new Promise<boolean>((resolve) => {
                const disposable = this.terminalManager.onDidChangeTerminalShellIntegration(() => {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    clearTimeout(timer);
                    disposable.dispose();
                    resolve(true);
                });
                const TIMEOUT_DURATION = 500;
                const timer = setTimeout(() => {
                    disposable.dispose();
                    resolve(true);
                }, TIMEOUT_DURATION);
            });
            await promise;
        }

        if (terminal.shellIntegration) {
            const execution = terminal.shellIntegration.executeCommand(commandLine);
            traceVerbose(`Shell Integration is enabled, executeCommand: ${commandLine}`);
            return execution;
        } else {
            terminal.sendText(commandLine);
            traceVerbose(`Shell Integration is disabled, sendText: ${commandLine}`);
        }

        return undefined;
    }

    public async show(preserveFocus: boolean = true): Promise<void> {
        await this.ensureTerminal(preserveFocus);
        if (!this.options?.hideFromUser) {
            this.terminal!.show(preserveFocus);
        }
    }
    // TODO: Debt switch to Promise<Terminal> ---> breaks 20 tests
    public async ensureTerminal(preserveFocus: boolean = true): Promise<void> {
        if (this.terminal) {
            return;
        }

        if (useEnvExtension()) {
            this.terminal = await ensureTerminalLegacy(this.options?.resource, {
                name: this.options?.title || 'Python',
                hideFromUser: this.options?.hideFromUser,
            });
            return;
        } else {
            this.terminalShellType = this.terminalHelper.identifyTerminalShell(this.terminal);
            this.terminal = this.terminalManager.createTerminal({
                name: this.options?.title || 'Python',
                hideFromUser: this.options?.hideFromUser,
            });
            this.terminalAutoActivator.disableAutoActivation(this.terminal);

            await sleep(100);

            await this.terminalActivator.activateEnvironmentInTerminal(this.terminal, {
                resource: this.options?.resource,
                preserveFocus,
                interpreter: this.options?.interpreter,
                hideFromUser: this.options?.hideFromUser,
            });
        }

        if (!this.options?.hideFromUser) {
            this.terminal.show(preserveFocus);
        }

        this.sendTelemetry().ignoreErrors();
        return;
    }
    private terminalCloseHandler(terminal: Terminal) {
        if (terminal === this.terminal) {
            this.terminalClosed.fire();
            this.terminal = undefined;
            this.isReplReady = false;
            this.disposeReplListener();
            this.pythonReplCommandQueue = [];
        }
    }

    private async sendTelemetry() {
        const pythonPath = this.serviceContainer
            .get<IConfigurationService>(IConfigurationService)
            .getSettings(this.options?.resource).pythonPath;
        const interpreterInfo =
            this.options?.interpreter ||
            (await this.serviceContainer
                .get<IInterpreterService>(IInterpreterService)
                .getInterpreterDetails(pythonPath));
        const pythonVersion = interpreterInfo && interpreterInfo.version ? interpreterInfo.version.raw : undefined;
        const interpreterType = interpreterInfo ? interpreterInfo.envType : undefined;
        captureTelemetry(EventName.TERMINAL_CREATE, {
            terminal: this.terminalShellType,
            pythonVersion,
            interpreterType,
        });
    }
}
