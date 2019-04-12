// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService } from '../../common/types';
import { generateCellRanges } from '../cellFactory';
import { IDataScienceTextEditorDecorator } from '../types';

@injectable()
export class Decorator implements IDataScienceTextEditorDecorator {

    private activeCellType: vscode.TextEditorDecorationType;
    private timer: NodeJS.Timer | undefined;

    constructor(@inject(IDocumentManager) private documentManager: IDocumentManager,
                @inject(IConfigurationService) private configuration: IConfigurationService)
    {
        this.activeCellType = this.documentManager.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('sideBarSectionHeader.background'),
            isWholeLine: true
        });
        this.configuration.getSettings().onDidChange(this.settingsChanged, this);
        this.settingsChanged();
        this.documentManager.onDidChangeActiveTextEditor(this.changedEditor, this);
        this.documentManager.onDidChangeTextEditorSelection(this.changedSelection, this);
        this.documentManager.onDidChangeTextDocument(this.changedDocument, this);
    }

    private settingsChanged() {
        if (this.documentManager.activeTextEditor) {
            this.triggerUpdate(this.documentManager.activeTextEditor);
        }
    }

    private changedEditor(editor: vscode.TextEditor | undefined) {
        this.triggerUpdate(editor);
    }

    private changedDocument(e: vscode.TextDocumentChangeEvent) {
        if (this.documentManager.activeTextEditor && e.document === this.documentManager.activeTextEditor.document) {
            this.triggerUpdate(this.documentManager.activeTextEditor);
        }
    }

    private changedSelection(e: vscode.TextEditorSelectionChangeEvent) {
        if (e.textEditor && e.textEditor.selection.anchor) {
            this.triggerUpdate(e.textEditor);
        }
    }

    private triggerUpdate(editor: vscode.TextEditor | undefined) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.update(editor), 100);
    }

    private update(editor: vscode.TextEditor | undefined) {
        if (editor && editor.document && editor.document.languageId === PYTHON_LANGUAGE) {
            const settings = this.configuration.getSettings().datascience;
            if (settings.decorateCells && settings.enabled) {
                // Find all of the cells
                const cells = generateCellRanges(editor.document, this.configuration.getSettings().datascience);
                const cellRanges = cells.map(c => c.range).filter(r => r.contains(editor.selection.anchor));
                editor.setDecorations(this.activeCellType, cellRanges);
            } else {
                editor.setDecorations(this.activeCellType, []);
            }
        }
    }
}
