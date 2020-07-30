// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { QuickPickItem, QuickPickOptions, Uri } from 'vscode';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';
import { ICommandNameArgumentTypeMapping } from '../../common/application/commands';
import { IApplicationShell, ICommandManager } from '../../common/application/types';

import { IDisposable } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { isUri } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { ExportManager } from '../export/exportManager';
import { ExportFormat, IExportManager } from '../export/types';
import { IDataScienceFileSystem, INotebookEditorProvider, INotebookModel } from '../types';

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
        @inject(INotebookEditorProvider) private readonly notebookProvider: INotebookEditorProvider,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem
    ) {}
    public register() {
        this.registerCommand(Commands.ExportAsPythonScript, (model) => this.export(model, ExportFormat.python));
        this.registerCommand(Commands.ExportToHTML, (model, defaultFileName?) =>
            this.export(model, ExportFormat.html, defaultFileName)
        );
        this.registerCommand(Commands.ExportToPDF, (model, defaultFileName?) =>
            this.export(model, ExportFormat.pdf, defaultFileName)
        );
        this.registerCommand(Commands.Export, (model, defaultFileName?) =>
            this.export(model, undefined, defaultFileName)
        );
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

    private async export(modelOrUri: Uri | INotebookModel, exportMethod?: ExportFormat, defaultFileName?: string) {
        defaultFileName = typeof defaultFileName === 'string' ? defaultFileName : undefined;
        let model: INotebookModel | undefined;
        if (modelOrUri && isUri(modelOrUri)) {
            const uri = modelOrUri;
            const editor = this.notebookProvider.editors.find((item) => this.fs.arePathsSame(item.file, uri));
            if (editor && editor.model) {
                model = editor.model;
            }
        } else {
            model = modelOrUri;
        }
        if (!model) {
            // if no model was passed then this was called from the command palette,
            // so we need to get the active editor
            const activeEditor = this.notebookProvider.activeEditor;
            if (!activeEditor || !activeEditor.model) {
                return;
            }
            model = activeEditor.model;

            if (exportMethod) {
                sendTelemetryEvent(Telemetry.ExportNotebookAsCommand, undefined, { format: exportMethod });
            }
        }

        if (exportMethod) {
            await this.exportManager.export(exportMethod, model, defaultFileName);
        } else {
            // if we don't have an export method we need to ask for one and display the
            // quickpick menu
            const pickedItem = await this.showExportQuickPickMenu(model, defaultFileName).then((item) => item);
            if (pickedItem !== undefined) {
                pickedItem.handler();
            } else {
                sendTelemetryEvent(Telemetry.ClickedExportNotebookAsQuickPick);
            }
        }
    }

    private getExportQuickPickItems(model: INotebookModel, defaultFileName?: string): IExportQuickPickItem[] {
        return [
            {
                label: DataScience.exportPythonQuickPickLabel(),
                picked: true,
                handler: () => {
                    sendTelemetryEvent(Telemetry.ClickedExportNotebookAsQuickPick, undefined, {
                        format: ExportFormat.python
                    });
                    this.commandManager.executeCommand(Commands.ExportAsPythonScript, model);
                }
            },
            {
                label: DataScience.exportHTMLQuickPickLabel(),
                picked: false,
                handler: () => {
                    sendTelemetryEvent(Telemetry.ClickedExportNotebookAsQuickPick, undefined, {
                        format: ExportFormat.html
                    });
                    this.commandManager.executeCommand(Commands.ExportToHTML, model, defaultFileName);
                }
            },
            {
                label: DataScience.exportPDFQuickPickLabel(),
                picked: false,
                handler: () => {
                    sendTelemetryEvent(Telemetry.ClickedExportNotebookAsQuickPick, undefined, {
                        format: ExportFormat.pdf
                    });
                    this.commandManager.executeCommand(Commands.ExportToPDF, model, defaultFileName);
                }
            }
        ];
    }

    private async showExportQuickPickMenu(
        model: INotebookModel,
        defaultFileName?: string
    ): Promise<IExportQuickPickItem | undefined> {
        const items = this.getExportQuickPickItems(model, defaultFileName);

        const options: QuickPickOptions = {
            ignoreFocusOut: false,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: getLocString('DataScience.exportAsQuickPickPlaceholder', 'Export As...')
        };

        return this.applicationShell.showQuickPick(items, options);
    }
}
