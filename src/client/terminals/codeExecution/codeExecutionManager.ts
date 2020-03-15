// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';

import { ICommandManager, IDocumentManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    BANNER_NAME_INTERACTIVE_SHIFTENTER,
    IDisposableRegistry,
    IPythonExtensionBanner,
    Resource
} from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
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
        @inject(IPythonExtensionBanner)
        @named(BANNER_NAME_INTERACTIVE_SHIFTENTER)
        private readonly shiftEnterBanner: IPythonExtensionBanner,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer
    ) {}

    public get onExecutedCode(): Event<string> {
        return this.eventEmitter.event;
    }

    public registerCommands() {
        [Commands.Exec_In_Terminal, Commands.Exec_In_Terminal_Icon].forEach(cmd => {
            this.disposableRegistry.push(
                this.commandManager.registerCommand(
                    // tslint:disable-next-line:no-any
                    cmd as any,
                    async (file: Resource) => {
                        const trigger = cmd === Commands.Exec_In_Terminal ? 'command' : 'icon';
                        await this.executeFileInTerminal(file, trigger).catch(ex =>
                            traceError('Failed to execute file in terminal', ex)
                        );
                    }
                )
            );
        });
        this.disposableRegistry.push(
            this.commandManager.registerCommand(
                Commands.Exec_Selection_In_Terminal,
                this.executeSelectionInTerminal.bind(this)
            )
        );
        this.disposableRegistry.push(
            this.commandManager.registerCommand(
                Commands.Exec_Selection_In_Django_Shell,
                this.executeSelectionInDjangoShell.bind(this)
            )
        );
    }
    private async executeFileInTerminal(file: Resource, trigger: 'command' | 'icon') {
        sendTelemetryEvent(EventName.EXECUTION_CODE, undefined, { scope: 'file', trigger });
        const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper);
        file = file instanceof Uri ? file : undefined;
        const fileToExecute = file ? file : await codeExecutionHelper.getFileToExecute();
        if (!fileToExecute) {
            return;
        }
        await codeExecutionHelper.saveFileIfDirty(fileToExecute);

        try {
            const contents = await this.fileSystem.readFile(fileToExecute.fsPath);
            this.eventEmitter.fire(contents);
        } catch {
            // Ignore any errors that occur for firing this event. It's only used
            // for telemetry
            noop();
        }

        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard');
        await executionService.executeFile(fileToExecute);
    }

    @captureTelemetry(EventName.EXECUTION_CODE, { scope: 'selection' }, false)
    private async executeSelectionInTerminal(): Promise<void> {
        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard');

        await this.executeSelection(executionService);
        // Prompt one time to ask if they want to send shift-enter to the Interactive Window
        this.shiftEnterBanner.showBanner().ignoreErrors();
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
}
