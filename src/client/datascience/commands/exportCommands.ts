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
import { INotebookModel } from '../types';

interface IExportQuickPickItem extends QuickPickItem {
    handler(): void;
}

@injectable()
export class ExportCommands implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExportManager) private exportManager: ExportManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell
    ) {}
    public register() {
        this.registerCommand(Commands.ExportAsPythonScript, (model) => this.export(model, ExportFormat.python));
        this.registerCommand(Commands.ExportToHTML, (model) => this.export(model, ExportFormat.html));
        this.registerCommand(Commands.ExportToPDF, (model) => this.export(model, ExportFormat.pdf));
        this.registerCommand(Commands.Export, (model) => this.export(model));
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

    private async export(model: INotebookModel, exportMethod?: ExportFormat) {
        if (exportMethod) {
            await this.exportManager.export(exportMethod, model);
        } else {
            const pickedItem = await this.showExportQuickPickMenu(model).then((item) => item);
            if (pickedItem !== undefined) {
                pickedItem.handler();
            }
        }
    }

    private getExportQuickPickItems(model: INotebookModel): IExportQuickPickItem[] {
        return [
            {
                label: 'Python Script',
                picked: true,
                handler: () => this.commandManager.executeCommand(Commands.ExportAsPythonScript, model)
            }
            //{ label: 'HTML', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToHTML) },
            //{ label: 'PDF', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToPDF) }
        ];
    }

    private async showExportQuickPickMenu(model: INotebookModel): Promise<IExportQuickPickItem | undefined> {
        const items = this.getExportQuickPickItems(model);

        const options: QuickPickOptions = {
            ignoreFocusOut: false,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Export As...'
        };

        return this.applicationShell.showQuickPick(items, options);
    }
}
