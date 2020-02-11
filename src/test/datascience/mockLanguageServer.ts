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

    public handleChanges(document: TextDocument, changes: TextDocumentContentChangeEvent[]) {
        this.versionId = document.version;
        this.applyChanges(changes);
        this.resolveNotificationPromise();
    }

    public handleOpen(_document: TextDocument) {
        noop();
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

    private applyChanges(changes: TextDocumentContentChangeEvent[]) {
        changes.forEach(c => {
            const before = this.contents.substr(0, c.rangeOffset);
            const after = this.contents.substr(c.rangeOffset + c.rangeLength);
            this.contents = `${before}${c.text}${after}`;
        });
        this.versionId = this.versionId + 1;
    }

    private resolveNotificationPromise() {
        if (this.notificationPromise) {
            this.notificationPromise.resolve();
            this.notificationPromise = undefined;
        }
    }
}
