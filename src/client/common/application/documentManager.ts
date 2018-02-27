// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { injectable } from 'inversify';
import { Event, TextDocument, TextDocumentShowOptions, TextEditor, TextEditorOptionsChangeEvent, TextEditorSelectionChangeEvent, TextEditorViewColumnChangeEvent, Uri, ViewColumn, window, workspace } from 'vscode';
import { IDocumentManager } from './types';

@injectable()
export class DocumentManager implements IDocumentManager {
    public get textDocuments(): TextDocument[] {
        return workspace.textDocuments;
    }
    public get activeTextEditor(): TextEditor | undefined {
        return window.activeTextEditor;
    }
    public get visibleTextEditors(): TextEditor[] {
        return window.visibleTextEditors;
    }
    public get onDidChangeActiveTextEditor(): Event<TextEditor> {
        return window.onDidChangeActiveTextEditor;
    }
    public get onDidChangeVisibleTextEditors(): Event<TextEditor[]> {
        return window.onDidChangeVisibleTextEditors;
    }
    public get onDidChangeTextEditorSelection(): Event<TextEditorSelectionChangeEvent> {
        return window.onDidChangeTextEditorSelection;
    }
    public get onDidChangeTextEditorOptions(): Event<TextEditorOptionsChangeEvent> {
        return window.onDidChangeTextEditorOptions;
    }
    public get onDidChangeTextEditorViewColumn(): Event<TextEditorViewColumnChangeEvent> {
        return window.onDidChangeTextEditorViewColumn;
    }
    public get onDidOpenTextDocument(): Event<TextDocument> {
        return workspace.onDidOpenTextDocument;
    }
    public get onDidCloseTextDocument(): Event<TextDocument> {
        return workspace.onDidCloseTextDocument;
    }
    public get onDidSaveTextDocument(): Event<TextDocument> {
        return workspace.onDidSaveTextDocument;
    }
    public showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Thenable<TextEditor>;
    public showTextDocument(document: TextDocument | Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;
    public showTextDocument(uri: any, options?: any, preserveFocus?: any): Thenable<TextEditor> {
        return window.showTextDocument(uri, options, preserveFocus);
    }
}
