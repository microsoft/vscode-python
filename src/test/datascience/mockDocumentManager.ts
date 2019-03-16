// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as TypeMoq from 'typemoq';
import {
    Event,
    EventEmitter,
    TextDocument,
    TextDocumentShowOptions,
    TextEditor,
    TextEditorOptionsChangeEvent,
    TextEditorSelectionChangeEvent,
    TextEditorViewColumnChangeEvent,
    Uri,
    ViewColumn,
    WorkspaceEdit
} from 'vscode';

import { IDocumentManager } from '../../client/common/application/types';
import { createDocument } from './editor-integration/helpers';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

function createTypeMoq<T>(tag: string): TypeMoq.IMock<T> {
    // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
    // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
    const result = TypeMoq.Mock.ofType<T>();
    (result as any)['tag'] = tag;
    result.setup((x: any) => x.then).returns(() => undefined);
    return result;
}

export class MockDocumentManager implements IDocumentManager {
    public textDocuments: TextDocument[] = [];
    public activeTextEditor: TextEditor | undefined;
    public visibleTextEditors: TextEditor[] = [];
    private didChangeEmitter = new EventEmitter<TextEditor>();
    private didOpenEmitter = new EventEmitter<TextDocument>();
    private didChangeVisibleEmitter = new EventEmitter<TextEditor[]>();
    private didChangeTextEditorSelectionEmitter = new EventEmitter<TextEditorSelectionChangeEvent>();
    private didChangeTextEditorOptionsEmitter = new EventEmitter<TextEditorOptionsChangeEvent>();
    private didChangeTextEditorViewColumnEmitter = new EventEmitter<TextEditorViewColumnChangeEvent>();
    private didCloseEmitter = new EventEmitter<TextDocument>();
    private didSaveEmitter = new EventEmitter<TextDocument>();
    public get onDidChangeActiveTextEditor(): Event<TextEditor> {
        return this.didChangeEmitter.event;
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
    public showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Thenable<TextEditor>;
    public showTextDocument(document: TextDocument | Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;
    public showTextDocument(document: any, column?: any, preserveFocus?: any): Thenable<TextEditor> {
        const mockEditor = createTypeMoq<TextEditor>('TextEditor');
        mockEditor.setup(e => e.document).returns(() => this.lastDocument);
        this.activeTextEditor = mockEditor.object;
        return Promise.resolve(mockEditor.object);
    }
    public openTextDocument(fileName: string | Uri): Thenable<TextDocument>;
    public openTextDocument(options?: { language?: string; content?: string }): Thenable<TextDocument>;
    public openTextDocument(options?: any): Thenable<TextDocument> {
        return Promise.resolve(this.lastDocument);
    }
    public applyEdit(edit: WorkspaceEdit): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public addDocument(code: string, file: string) {
        const mockDoc = createDocument(code, file, 1, TypeMoq.Times.atMost(100), true);
        mockDoc.setup((x: any) => x.then).returns(() => undefined);
        this.textDocuments.push(mockDoc.object);
    }

    private get lastDocument() : TextDocument {
        if (this.textDocuments.length > 0) {
            return this.textDocuments[this.textDocuments.length - 1];
        }
        throw new Error('No documents in MockDocumentManager');
    }
}
