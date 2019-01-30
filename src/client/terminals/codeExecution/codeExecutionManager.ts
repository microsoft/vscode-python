// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { BANNER_NAME_INTERACTIVE_SHIFTENTER, IDisposableRegistry, IPythonExtensionBanner } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from '../../terminals/types';

@injectable()
export class CodeExecutionManager implements ICodeExecutionManager {
    constructor(@inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(IPythonExtensionBanner) @named(BANNER_NAME_INTERACTIVE_SHIFTENTER) private readonly shiftEnterBanner: IPythonExtensionBanner,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer) {

    }

    public registerCommands() {
        this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_In_Terminal, this.executeFileInterTerminal.bind(this)));
        this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_Selection_In_Terminal, this.executeSelectionInTerminal.bind(this)));
        this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_Selection_In_Django_Shell, this.executeSelectionInDjangoShell.bind(this)));
    }
    @captureTelemetry(EventName.EXECUTION_CODE, { scope: 'file' }, false)
    private async executeFileInterTerminal(file?: Uri) {
        const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper);
        file = file instanceof Uri ? file : undefined;
        const fileToExecute = file ? file : await codeExecutionHelper.getFileToExecute();
        if (!fileToExecute) {
            return;
        }
        await codeExecutionHelper.saveFileIfDirty(fileToExecute);
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

        await executionService.execute(normalizedCode, activeEditor!.document.uri);
    }
}
