// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    CancellationToken,
    CodeLens,
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentSymbol,
    Hover,
    Location,
    LocationLink,
    Position,
    ProviderResult,
    ReferenceContext,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    TextDocument,
    TextDocumentContentChangeEvent,
    WorkspaceEdit
} from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient/node';

import { ILanguageServer } from '../../client/activation/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';

// tslint:disable:no-any unified-signatures
export class MockLanguageServer implements ILanguageServer {
    private notificationPromise: Deferred<void> | undefined;
    private contents = '';
    private versionId: number = 0;

    public waitForNotification(): Promise<void> {
        this.notificationPromise = createDeferred();
        return this.notificationPromise.promise;
    }

    public getDocumentContents(): string {
        return this.contents;
    }

    public getVersionId(): number | null {
        return this.versionId;
    }

    public get connection() {
        // Return an object that looks like a connection
        return {
            sendNotification: this.sendNotification.bind(this) as any,
            sendRequest: noop as any,
            sendProgress: noop as any,
            onRequest: noop as any,
            onNotification: noop as any,
            onProgress: noop as any
        };
    }

    public get capabilities() {
        return {
            textDocumentSync: 2 // This is increment value. Means we support changes
        } as any;
    }

    public provideRenameEdits(
        _document: TextDocument,
        _position: Position,
        _newName: string,
        _token: CancellationToken
    ): ProviderResult<WorkspaceEdit> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideDefinition(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken
    ): ProviderResult<Location | Location[] | LocationLink[]> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideHover(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken
    ): ProviderResult<Hover> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideReferences(
        _document: TextDocument,
        _position: Position,
        _context: ReferenceContext,
        _token: CancellationToken
    ): ProviderResult<Location[]> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideCompletionItems(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: CompletionContext
    ): ProviderResult<CompletionItem[] | CompletionList> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideCodeLenses(_document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideDocumentSymbols(
        _document: TextDocument,
        _token: CancellationToken
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        this.resolveNotificationPromise();
        return null;
    }
    public provideSignatureHelp(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: SignatureHelpContext
    ): ProviderResult<SignatureHelp> {
        this.resolveNotificationPromise();
        return null;
    }
    public dispose(): void {
        noop();
    }

    public disconnect(): void {
        noop();
    }

    public reconnect(): void {
        noop();
    }

    private sendNotification(method: any, params: any): void {
        if (method === vscodeLanguageClient.DidChangeTextDocumentNotification.type) {
            const doc = params.textDocument;
            this.versionId = doc.version;
            const changes = params.contentChanges;
            this.applyChanges(changes);
            this.resolveNotificationPromise();
        }
    }

    private applyChanges(changes: TextDocumentContentChangeEvent[]) {
        changes.forEach((c) => {
            const offset = this.computeOffset(c);
            const before = this.contents.substr(0, offset);
            const after = this.contents.substr(offset + c.rangeLength);
            this.contents = `${before}${c.text}${after}`;
        });
        this.versionId = this.versionId + 1;
    }

    private computeOffset(c: TextDocumentContentChangeEvent): number {
        // range offset is no longer available. Have to compute it using the contents
        const lines = this.contents.splitLines({ trim: false, removeEmptyEntries: false });
        let offset = 0;
        for (let i = 0; i < c.range.start.line; i += 1) {
            offset += lines[i].length + 1; // + 1 for the linefeed
        }
        offset += c.range.start.character;
        return offset;
    }

    private resolveNotificationPromise() {
        if (this.notificationPromise) {
            this.notificationPromise.resolve();
            this.notificationPromise = undefined;
        }
    }
}
