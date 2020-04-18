// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as path from 'path';
import {
    DecorationRenderOptions,
    Event,
    EventEmitter,
    Range,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentShowOptions,
    TextEditor,
    TextEditorDecorationType,
    TextEditorOptionsChangeEvent,
    TextEditorSelectionChangeEvent,
    TextEditorViewColumnChangeEvent,
    Uri,
    ViewColumn,
    WorkspaceEdit
} from 'vscode';

import { IDocumentManager } from '../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { MockDocument } from './mockDocument';
import { MockEditor } from './mockTextEditor';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

export class MockDocumentManager implements IDocumentManager {
    public textDocuments: TextDocument[] = [];
    public activeTextEditor: TextEditor | undefined;
    public visibleTextEditors: TextEditor[] = [];
    public didChangeActiveTextEditorEmitter = new EventEmitter<TextEditor>();
    private didOpenEmitter = new EventEmitter<TextDocument>();
    private didChangeVisibleEmitter = new EventEmitter<TextEditor[]>();
    private didChangeTextEditorSelectionEmitter = new EventEmitter<TextEditorSelectionChangeEvent>();
    private didChangeTextEditorOptionsEmitter = new EventEmitter<TextEditorOptionsChangeEvent>();
    private didChangeTextEditorViewColumnEmitter = new EventEmitter<TextEditorViewColumnChangeEvent>();
    private didCloseEmitter = new EventEmitter<TextDocument>();
    private didSaveEmitter = new EventEmitter<TextDocument>();
    private didChangeTextDocumentEmitter = new EventEmitter<TextDocumentChangeEvent>();
    public get onDidChangeActiveTextEditor(): Event<TextEditor | undefined> {
        return this.didChangeActiveTextEditorEmitter.event;
    }
    public get onDidChangeTextDocument(): Event<TextDocumentChangeEvent> {
        return this.didChangeTextDocumentEmitter.event;
    }
    public get onDidOpenTextDocument(): Event<TextDocument> {
        return this.didOpenEmitter.event;
    }
    public get onDidChangeVisibleTextEditors(): Event<TextEditor[]> {
        return this.didChangeVisibleEmitter.event;
    }
    public get onDidChangeTextEditorSelection(): Event<TextEditorSelectionChangeEvent> {
        return this.didChangeTextEditorSelectionEmitter.event;
    }
    public get onDidChangeTextEditorOptions(): Event<TextEditorOptionsChangeEvent> {
        return this.didChangeTextEditorOptionsEmitter.event;
    }
    public get onDidChangeTextEditorViewColumn(): Event<TextEditorViewColumnChangeEvent> {
        return this.didChangeTextEditorViewColumnEmitter.event;
    }
    public get onDidCloseTextDocument(): Event<TextDocument> {
        return this.didCloseEmitter.event;
    }
    public get onDidSaveTextDocument(): Event<TextDocument> {
        return this.didSaveEmitter.event;
    }
    public showTextDocument(
        _document: TextDocument,
        _column?: ViewColumn,
        _preserveFocus?: boolean
    ): Thenable<TextEditor>;
    public showTextDocument(_document: TextDocument | Uri, _options?: TextDocumentShowOptions): Thenable<TextEditor>;
    public showTextDocument(document: any, _column?: any, _preserveFocus?: any): Thenable<TextEditor> {
        this.visibleTextEditors.push(document);
        const mockEditor = new MockEditor(this, this.lastDocument as MockDocument);
        this.activeTextEditor = mockEditor;
        this.didChangeActiveTextEditorEmitter.fire(this.activeTextEditor);
        return Promise.resolve(mockEditor);
    }
    public openTextDocument(_fileName: string | Uri): Thenable<TextDocument>;
    public openTextDocument(_options?: { language?: string; content?: string }): Thenable<TextDocument>;
    public openTextDocument(_options?: any): Thenable<TextDocument> {
        if (_options && _options.content) {
            const doc = new MockDocument(_options.content, 'Untitled-1', this.saveDocument);
            this.textDocuments.push(doc);
        }
        return Promise.resolve(this.lastDocument);
    }
    public applyEdit(_edit: WorkspaceEdit): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public addDocument(code: string, file: string) {
        const mockDoc = new MockDocument(code, file, this.saveDocument);
        this.textDocuments.push(mockDoc);
        return mockDoc;
    }

    public changeDocument(file: string, changes: { range: Range; newText: string }[]) {
        const doc = this.textDocuments.find((d) => d.uri.fsPath === Uri.file(file).fsPath) as MockDocument;
        if (doc) {
            const contentChanges = changes.map((c) => {
                const startOffset = doc.offsetAt(c.range.start);
                const endOffset = doc.offsetAt(c.range.end);
                return {
                    range: c.range,
                    rangeOffset: startOffset,
                    rangeLength: endOffset - startOffset,
                    text: c.newText
                };
            });
            const ev: TextDocumentChangeEvent = {
                document: doc,
                contentChanges
            };
            // Changes are applied to the doc before it's sent.
            ev.contentChanges.forEach(doc.edit.bind(doc));
            this.didChangeTextDocumentEmitter.fire(ev);
        }
    }

    public createTextEditorDecorationType(_options: DecorationRenderOptions): TextEditorDecorationType {
        throw new Error('Method not implemented');
    }

    private get lastDocument(): TextDocument {
        if (this.textDocuments.length > 0) {
            return this.textDocuments[this.textDocuments.length - 1];
        }
        throw new Error('No documents in MockDocumentManager');
    }

    private saveDocument = (doc: TextDocument): Promise<boolean> => {
        // Create a new document with the contents of the doc passed in
        this.addDocument(doc.getText(), path.join(EXTENSION_ROOT_DIR, 'baz.py'));
        return Promise.resolve(true);
    };
}
