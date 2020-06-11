// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { QuickPickItem, QuickPickOptions } from 'vscode';
import { ICommandNameArgumentTypeMapping } from '../../common/application/commands';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { Commands } from '../constants';
import { ExportFormat, ExportManager, IExportManager } from '../export/exportManager';
import { INotebookEditorProvider } from '../types';

interface IExportQuickPickItem extends QuickPickItem {
    handler(): void;
}

@injectable()
export class ExportCommands implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExportManager) private exportManager: ExportManager,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell
    ) {}
    public register() {
        this.registerCommand(Commands.ExportAsPythonScript, () => this.export(ExportFormat.python));
        this.registerCommand(Commands.ExportToHTML, () => this.export(ExportFormat.html));
        this.registerCommand(Commands.ExportToPDF, () => this.export(ExportFormat.pdf));
        this.registerCommand(Commands.Export, this.export);
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }

    private registerCommand<
        E extends keyof ICommandNameArgumentTypeMapping,
        U extends ICommandNameArgumentTypeMapping[E]
        // tslint:disable-next-line: no-any
    >(command: E, callback: (...args: U) => any) {
        const disposable = this.commandManager.registerCommand(command, callback, this);
        this.disposables.push(disposable);
    }

    private async export(exportMethod?: ExportFormat) {
        // get notebook provider
        const model = this.notebookEditorProvider.activeEditor?.model;
        if (!model) {
            throw Error('No active editor found.');
        }

        if (exportMethod) {
            await this.exportManager.export(exportMethod, model);
        } else {
            const pickedItem = await this.showExportQuickPickMenu().then((item) => item);
            if (pickedItem !== undefined) {
                pickedItem.handler();
            }
        }
    }

    private getExportQuickPickItems(): IExportQuickPickItem[] {
        return [
            {
                label: 'Python Script',
                picked: true,
                handler: () => this.commandManager.executeCommand(Commands.ExportAsPythonScript)
            }
            //{ label: 'HTML', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToHTML) },
            //{ label: 'PDF', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToPDF) }
        ];
    }

    private async showExportQuickPickMenu(): Promise<IExportQuickPickItem | undefined> {
        const items = this.getExportQuickPickItems();

        const options: QuickPickOptions = {
            ignoreFocusOut: false,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Export As...'
        };

        return this.applicationShell.showQuickPick(items, options);
    }
}
