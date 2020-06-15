// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { QuickPickItem, QuickPickOptions } from 'vscode';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';
import { ICommandNameArgumentTypeMapping } from '../../common/application/commands';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { Commands } from '../constants';
import { ExportManager } from '../export/exportManager';
import { ExportFormat, IExportManager } from '../export/types';
import { INotebookEditorProvider, INotebookModel } from '../types';

interface IExportQuickPickItem extends QuickPickItem {
    handler(): void;
}

@injectable()
export class ExportCommands implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExportManager) private exportManager: ExportManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(INotebookEditorProvider) private readonly notebookProvider: INotebookEditorProvider
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
        if (!model) {
            // if no model was passed then this was called from the command pallete,
            // so we need to get the active editor
            const activeEditor = this.notebookProvider.activeEditor;
            if (!activeEditor || !activeEditor.model) {
                return;
            }
            model = activeEditor.model;
        }

        if (exportMethod) {
            await this.exportManager.export(exportMethod, model);
        } else {
            // if we don't have an export method we need to ask for one and display the
            // quickpick menu
            const pickedItem = await this.showExportQuickPickMenu(model).then((item) => item);
            if (pickedItem !== undefined) {
                pickedItem.handler();
            }
        }
    }

    private getExportQuickPickItems(model: INotebookModel): IExportQuickPickItem[] {
        return [
            {
                label: DataScience.exportPythonQuickPickLabel(),
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
            placeHolder: getLocString('DataScience.exportAsQuickPickPlaceholder', 'Export As...')
        };

        return this.applicationShell.showQuickPick(items, options);
    }
}
