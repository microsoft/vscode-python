// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as vscode from 'vscode';

import { IExtensionActivationService } from '../../activation/types';
import { IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService, IDisposable, IDisposableRegistry, Resource } from '../../common/types';
import { DefaultTheme } from '../constants';
import { ICellHashProvider, ICodeCssGenerator, IFileHashes, IThemeFinder } from '../types';

interface ICellHashMatch {
    range: vscode.Range;
    executionCount: number;
    fileName: string;
}

@injectable()
export class ExecutionCountDecorator implements IExtensionActivationService, IDisposable {
    private timer: NodeJS.Timer | undefined | number;
    private decorations: Map<string, vscode.TextEditorDecorationType[]> = new Map<string, vscode.TextEditorDecorationType[]>();

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICellHashProvider) private hashProvider: ICellHashProvider,
        @inject(ICodeCssGenerator) private themeGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) private themeFinder: IThemeFinder,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService
    ) {
        disposables.push(this);
        disposables.push(this.configuration.getSettings().onDidChange(this.settingsChanged, this));
        disposables.push(this.documentManager.onDidChangeActiveTextEditor(this.changedEditor, this));
        disposables.push(this.documentManager.onDidChangeTextEditorSelection(this.changedSelection, this));
        disposables.push(this.documentManager.onDidChangeTextDocument(this.changedDocument, this));
        this.hashProvider.updated(this.hashesChanged.bind(this));
        this.settingsChanged();
    }

    public activate(_resource: Resource): Promise<void> {
        // We don't need to do anything here as we already did all of our work in the
        // constructor.
        return Promise.resolve();
    }

    public dispose() {
        if (this.timer) {
            // tslint:disable-next-line: no-any
            clearTimeout(this.timer as any);
        }
    }

    private settingsChanged() {
        if (this.documentManager.activeTextEditor) {
            this.triggerUpdate(this.documentManager.activeTextEditor);
        }
    }

    private hashesChanged() {
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
            // tslint:disable-next-line: no-any
            clearTimeout(this.timer as any);
        }
        this.timer = setTimeout(() => this.update(editor), 100);
    }

    private update(editor: vscode.TextEditor | undefined) {
        if (editor && editor.document && editor.document.languageId === PYTHON_LANGUAGE) {
            // Clear all of the old decorations
            this.clearDecorations(editor);

            const settings = this.configuration.getSettings().datascience;
            if (settings.enabled) {
                // Compute our comment color
                this.getCommentColor().then(c => {
                    // For each hash entry, generate our matches
                    const matches = this.generateMatches(editor.document, this.hashProvider.getHashes());

                    // For each match, generate a new decoration
                    matches.forEach(m => {
                        const decoration = this.createDecoration(m.executionCount, c);
                        editor.setDecorations(decoration, [m.range]);
                        this.saveDecoration(editor.document, decoration);
                    });
                }).ignoreErrors();

            }
        }
    }

    private async getCommentColor(): Promise<string | undefined> {
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);

        // First need to determine if this is a dark theme or not
        const isDark = await this.themeFinder.isThemeDark(theme);

        // Then use that to generate a set of monaco rules.
        const monacoThemeJson = await this.themeGenerator.generateMonacoTheme(isDark ? true : false, theme);

        // Parse that to get our color
        if (monacoThemeJson.rules) {
            // tslint:disable-next-line: no-any
            const monacoTheme = (monacoThemeJson as any) as monacoEditor.editor.IStandaloneThemeData;
            const commentRule = monacoTheme.rules.find(r => r.token.includes('comment'));
            if (commentRule && commentRule.foreground) {
                return commentRule.foreground;
            }
        }

        return undefined;
    }

    private generateMatches(document: vscode.TextDocument, hashes: IFileHashes[]): ICellHashMatch[] {
        const match = hashes.find(h => h.file === document.fileName);
        // if (match) {
        //     return match.hashes.map(h => {
        //         const line = document.lineAt(h.line - 2);
        //         return {
        //             range: line.rangeIncludingLineBreak,
        //             executionCount: h.executionCount,
        //             fileName: document.fileName
        //         };
        //     });
        // }

        return [];
    }

    private createDecoration(executionCount: number, commentColor: string | undefined): vscode.TextEditorDecorationType {
        return this.documentManager.createTextEditorDecorationType({
            after: {
                contentText: `    [${executionCount}]`,
                color: commentColor,
                margin: '-10px 0px 0px 0px'
            }
        });
    }

    private clearDecorations(editor: vscode.TextEditor) {
        const list = this.decorations.get(editor.document.fileName);
        if (list) {
            list.forEach(l => editor.setDecorations(l, []));
        }
        this.decorations.delete(editor.document.fileName);
    }

    private saveDecoration(document: vscode.TextDocument, decoration: vscode.TextEditorDecorationType) {
        let list = this.decorations.get(document.fileName);
        if (!list) {
            list = [];
        }
        list.push(decoration);
        this.decorations.set(document.fileName, list);
    }
}
