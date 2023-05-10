// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';

import { ICommandManager, IDocumentManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, IConfigurationService, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { traceError } from '../../logging';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from '../../terminals/types';

@injectable()
export class CodeExecutionManager implements ICodeExecutionManager {
    private eventEmitter: EventEmitter<string> = new EventEmitter<string>();
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IConfigurationService) private readonly configSettings: IConfigurationService,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
    ) {}

    public get onExecutedCode(): Event<string> {
        return this.eventEmitter.event;
    }

    public registerCommands() {
        [Commands.Exec_In_Terminal, Commands.Exec_In_Terminal_Icon, Commands.Exec_In_Separate_Terminal].forEach(
            (cmd) => {
                this.disposableRegistry.push(
                    this.commandManager.registerCommand(cmd as any, async (file: Resource) => {
                        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
                        const interpreter = await interpreterService.getActiveInterpreter(file);
                        if (!interpreter) {
                            this.commandManager
                                .executeCommand(Commands.TriggerEnvironmentSelection, file)
                                .then(noop, noop);
                            return;
                        }
                        const trigger = cmd === Commands.Exec_In_Terminal ? 'command' : 'icon';
                        await this.executeFileInTerminal(file, trigger, {
                            newTerminalPerFile: cmd === Commands.Exec_In_Separate_Terminal,
                        })
                            .then(() => {
                                if (this.shouldTerminalFocusOnStart(file))
                                    this.commandManager.executeCommand('workbench.action.terminal.focus');
                            })
                            .catch((ex) => traceError('Failed to execute file in terminal', ex));
                    }),
                );
            },
        );
        this.disposableRegistry.push(
            this.commandManager.registerCommand(Commands.Exec_Selection_In_Terminal as any, async (file: Resource) => {
                const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
                const interpreter = await interpreterService.getActiveInterpreter(file);
                if (!interpreter) {
                    this.commandManager.executeCommand(Commands.TriggerEnvironmentSelection, file).then(noop, noop);
                    return;
                }
                await this.executeSelectionInTerminal().then(() => {
                    if (this.shouldTerminalFocusOnStart(file))
                        this.commandManager.executeCommand('workbench.action.terminal.focus');
                });
            }),
        );
        this.disposableRegistry.push(
            this.commandManager.registerCommand(
                Commands.Exec_Selection_In_Django_Shell as any,
                async (file: Resource) => {
                    const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
                    const interpreter = await interpreterService.getActiveInterpreter(file);
                    if (!interpreter) {
                        this.commandManager.executeCommand(Commands.TriggerEnvironmentSelection, file).then(noop, noop);
                        return;
                    }
                    await this.executeSelectionInDjangoShell().then(() => {
                        if (this.shouldTerminalFocusOnStart(file))
                            this.commandManager.executeCommand('workbench.action.terminal.focus');
                    });
                },
            ),
        );
    }
    private async executeFileInTerminal(
        file: Resource,
        trigger: 'command' | 'icon',
        options?: { newTerminalPerFile: boolean },
    ): Promise<void> {
        sendTelemetryEvent(EventName.EXECUTION_CODE, undefined, {
            scope: 'file',
            trigger,
            newTerminalPerFile: options?.newTerminalPerFile,
        });
        const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper);
        file = file instanceof Uri ? file : undefined;
        let fileToExecute = file ? file : await codeExecutionHelper.getFileToExecute();
        if (!fileToExecute) {
            return;
        }
        const fileAfterSave = await codeExecutionHelper.saveFileIfDirty(fileToExecute);
        if (fileAfterSave) {
            fileToExecute = fileAfterSave;
        }

        try {
            const contents = await this.fileSystem.readFile(fileToExecute.fsPath);
            this.eventEmitter.fire(contents);
        } catch {
            // Ignore any errors that occur for firing this event. It's only used
            // for telemetry
            noop();
        }

        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard');
        await executionService.executeFile(fileToExecute, options);
    }

    @captureTelemetry(EventName.EXECUTION_CODE, { scope: 'selection' }, false)
    private async executeSelectionInTerminal(): Promise<void> {
        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard');

        await this.executeSelection(executionService);
    }

    @captureTelemetry(EventName.EXECUTION_DJANGO, { scope: 'selection' }, false)
    private async executeSelectionInDjangoShell(): Promise<void> {
        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'djangoShell');
        await this.executeSelection(executionService);
    }

    private async executeSelection(executionService: ICodeExecutionService): Promise<void> {
        const activeEditor = this.documentManager.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper);
        const codeToExecute = await codeExecutionHelper.getSelectedTextToExecute(activeEditor!);
        const normalizedCode = await codeExecutionHelper.normalizeLines(codeToExecute!);
        if (!normalizedCode || normalizedCode.trim().length === 0) {
            return;
        }

        try {
            this.eventEmitter.fire(normalizedCode);
        } catch {
            // Ignore any errors that occur for firing this event. It's only used
            // for telemetry
            noop();
        }

        await executionService.execute(normalizedCode, activeEditor!.document.uri);
    }

    private shouldTerminalFocusOnStart(uri: Uri | undefined): boolean {
        return this.configSettings.getSettings(uri)?.terminal.focusAfterLaunch;
    }
}
