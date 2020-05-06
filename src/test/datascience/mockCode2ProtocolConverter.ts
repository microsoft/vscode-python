// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as code from 'vscode';
import { Code2ProtocolConverter } from 'vscode-languageclient';
import * as proto from 'vscode-languageserver-protocol';

// tslint:disable:no-any unified-signatures
export class MockCode2ProtocolConverter implements Code2ProtocolConverter {
    public asTextDocumentIdentifier(textDocument: code.TextDocument): proto.TextDocumentIdentifier {
        return { uri: textDocument.uri.toString() };
    }
    public asVersionedTextDocumentIdentifier(textDocument: code.TextDocument): proto.VersionedTextDocumentIdentifier {
        return { uri: textDocument.uri.toString(), version: textDocument.version };
    }
    public asOpenTextDocumentParams(textDocument: code.TextDocument): proto.DidOpenTextDocumentParams {
        return {
            textDocument: {
                uri: textDocument.uri.toString(),
                languageId: 'PYTHON',
                version: textDocument.version,
                text: textDocument.getText()
            }
        };
    }

    public asChangeTextDocumentParams(textDocument: code.TextDocument): proto.DidChangeTextDocumentParams;
    public asChangeTextDocumentParams(event: code.TextDocumentChangeEvent): proto.DidChangeTextDocumentParams;
    public asChangeTextDocumentParams(arg: any): proto.DidChangeTextDocumentParams {
        if (this.isTextDocument(arg)) {
            return {
                textDocument: {
                    uri: arg.uri.toString(),
                    version: arg.version
                },
                contentChanges: [{ text: arg.getText() }]
            };
        } else if (this.isTextDocumentChangeEvent(arg)) {
            const document = arg.document;
            return {
                textDocument: {
                    uri: document.uri.toString(),
                    version: document.version
                },
                contentChanges: arg.contentChanges.map(
                    (change): proto.TextDocumentContentChangeEvent => {
                        const range = change.range;
                        return {
                            range: {
                                start: { line: range.start.line, character: range.start.character },
                                end: { line: range.end.line, character: range.end.character }
                            },
                            rangeLength: change.rangeLength,
                            text: change.text
                        };
                    }
                )
            };
        } else {
            throw Error('Unsupported text document change parameter');
        }
    }
    public asCloseTextDocumentParams(_textDocument: code.TextDocument): proto.DidCloseTextDocumentParams {
        throw new Error('Method not implemented.');
    }
    public asSaveTextDocumentParams(
        _textDocument: code.TextDocument,
        _includeContent?: boolean | undefined
    ): proto.DidSaveTextDocumentParams {
        throw new Error('Method not implemented.');
    }
    public asWillSaveTextDocumentParams(_event: code.TextDocumentWillSaveEvent): proto.WillSaveTextDocumentParams {
        throw new Error('Method not implemented.');
    }
    public asTextDocumentPositionParams(
        _textDocument: code.TextDocument,
        _position: code.Position
    ): proto.TextDocumentPositionParams {
        return {
            textDocument: {
                uri: _textDocument.uri.fsPath
            },
            position: {
                line: _position.line,
                character: _position.character
            }
        };
    }
    public asCompletionParams(
        _textDocument: code.TextDocument,
        _position: code.Position,
        _context: code.CompletionContext
    ): proto.CompletionParams {
        const triggerKind = _context.triggerKind as number;
        return {
            textDocument: {
                uri: _textDocument.uri.fsPath
            },
            position: {
                line: _position.line,
                character: _position.character
            },
            context: {
                triggerCharacter: _context.triggerCharacter,
                triggerKind: triggerKind as proto.CompletionTriggerKind
            }
        };
    }
    public asWorkerPosition(_position: code.Position): proto.Position {
        throw new Error('Method not implemented.');
    }
    public asPosition(value: code.Position): proto.Position;
    public asPosition(value: undefined): undefined;
    public asPosition(value: null): null;
    public asPosition(value: code.Position | null | undefined): proto.Position | null | undefined;
    public asPosition(_value: any): any {
        if (_value === undefined || _value === null) {
            return _value;
        }
        return { line: _value.line, character: _value.character };
    }
    public asRange(value: code.Range): proto.Range;
    public asRange(value: undefined): undefined;
    public asRange(value: null): null;
    public asRange(value: code.Range | null | undefined): proto.Range | null | undefined;
    public asRange(_value: any): any {
        throw new Error('Method not implemented.');
    }
    public asDiagnosticSeverity(_value: code.DiagnosticSeverity): number {
        throw new Error('Method not implemented.');
    }
    public asDiagnostic(_item: code.Diagnostic): proto.Diagnostic {
        throw new Error('Method not implemented.');
    }
    public asDiagnostics(_items: code.Diagnostic[]): proto.Diagnostic[] {
        throw new Error('Method not implemented.');
    }
    public asCompletionItem(_item: code.CompletionItem): proto.CompletionItem {
        throw new Error('Method not implemented.');
    }
    public asTextEdit(_edit: code.TextEdit): proto.TextEdit {
        throw new Error('Method not implemented.');
    }
    public asReferenceParams(
        _textDocument: code.TextDocument,
        _position: code.Position,
        _options: { includeDeclaration: boolean }
    ): proto.ReferenceParams {
        throw new Error('Method not implemented.');
    }
    public asCodeActionContext(_context: code.CodeActionContext): proto.CodeActionContext {
        throw new Error('Method not implemented.');
    }
    public asCommand(_item: code.Command): proto.Command {
        throw new Error('Method not implemented.');
    }
    public asCodeLens(_item: code.CodeLens): proto.CodeLens {
        throw new Error('Method not implemented.');
    }
    public asFormattingOptions(_item: code.FormattingOptions): proto.FormattingOptions {
        throw new Error('Method not implemented.');
    }
    public asDocumentSymbolParams(_textDocument: code.TextDocument): proto.DocumentSymbolParams {
        throw new Error('Method not implemented.');
    }
    public asCodeLensParams(_textDocument: code.TextDocument): proto.CodeLensParams {
        throw new Error('Method not implemented.');
    }
    public asDocumentLink(_item: code.DocumentLink): proto.DocumentLink {
        throw new Error('Method not implemented.');
    }
    public asDocumentLinkParams(_textDocument: code.TextDocument): proto.DocumentLinkParams {
        throw new Error('Method not implemented.');
    }
    public asSignatureHelpParams(
        _textDocument: code.TextDocument,
        _position: code.Position,
        _context: code.SignatureHelpContext
    ): proto.SignatureHelpParams {
        throw new Error('Method not implemented.');
    }
    public asPositions(_value: code.Position[]): proto.Position[] {
        throw new Error('Method not implemented.');
    }
    public asLocation(value: code.Location): proto.Location;
    public asLocation(value: undefined): undefined;
    public asLocation(value: null): null;
    public asLocation(value: code.Location | undefined | null): proto.Location | undefined | null;
    public asLocation(_value: any): any {
        throw new Error('Method not implemented.');
    }
    public asDiagnosticTag(_value: code.DiagnosticTag): number | undefined {
        throw new Error('Method not implemented.');
    }
    public asSymbolKind(_item: code.SymbolKind): proto.SymbolKind {
        throw new Error('Method not implemented.');
    }
    public asSymbolTag(_item: code.SymbolTag): 1 {
        throw new Error('Method not implemented.');
    }
    public asSymbolTags(_items: readonly code.SymbolTag[]): 1[] {
        throw new Error('Method not implemented.');
    }
    public asUri(_uri: code.Uri): string {
        throw new Error('Method not implemented.');
    }
    private isTextDocumentChangeEvent(value: any): value is code.TextDocumentChangeEvent {
        const candidate = <code.TextDocumentChangeEvent>value;
        return !!candidate.document && !!candidate.contentChanges;
    }

    private isTextDocument(value: any): value is code.TextDocument {
        const candidate = <code.TextDocument>value;
        return !!candidate.uri && !!candidate.version;
    }
}
