// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as code from 'vscode';
import { Protocol2CodeConverter } from 'vscode-languageclient';
// tslint:disable-next-line: match-default-export-name
import protocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import * as proto from 'vscode-languageserver-protocol';

// tslint:disable:no-any unified-signatures
export class MockProtocol2CodeConverter implements Protocol2CodeConverter {
    public asUri(_value: string): code.Uri {
        throw new Error('Method not implemented.');
    }

    public asDiagnostic(_diagnostic: proto.Diagnostic): code.Diagnostic {
        throw new Error('Method not implemented.');
    }
    public asDiagnostics(_diagnostics: proto.Diagnostic[]): code.Diagnostic[] {
        throw new Error('Method not implemented.');
    }

    public asPosition(value: proto.Position): code.Position;
    public asPosition(value: undefined): undefined;
    public asPosition(value: null): null;
    public asPosition(value: proto.Position | null | undefined): code.Position | null | undefined;
    public asPosition(value: any): any {
        if (!value) {
            return undefined;
        }
        return new code.Position(value.line, value.character);
    }
    public asRange(value: proto.Range): code.Range;
    public asRange(value: undefined): undefined;
    public asRange(value: null): null;
    public asRange(value: proto.Range | null | undefined): code.Range | null | undefined;
    public asRange(value: any): any {
        if (!value) {
            return undefined;
        }
        return new code.Range(this.asPosition(value.start), this.asPosition(value.end));
    }
    public asDiagnosticSeverity(_value: number | null | undefined): code.DiagnosticSeverity {
        throw new Error('Method not implemented.');
    }
    public asHover(hover: proto.Hover): code.Hover;
    public asHover(hover: null | undefined): undefined;
    public asHover(hover: proto.Hover | null | undefined): code.Hover | undefined;
    public asHover(_hover: any): any {
        throw new Error('Method not implemented.');
    }
    public asCompletionResult(result: proto.CompletionList): code.CompletionList;
    public asCompletionResult(result: proto.CompletionItem[]): code.CompletionItem[];
    public asCompletionResult(result: null | undefined): undefined;
    public asCompletionResult(
        result: proto.CompletionList | proto.CompletionItem[] | null | undefined
    ): code.CompletionList | code.CompletionItem[] | undefined;
    public asCompletionResult(result: any): any {
        if (!result) {
            return undefined;
        }
        if (Array.isArray(result)) {
            const items = <proto.CompletionItem[]>result;
            return items.map(this.asCompletionItem.bind(this));
        }
        const list = <proto.CompletionList>result;
        return new code.CompletionList(list.items.map(this.asCompletionItem.bind(this)), list.isIncomplete);
    }
    public asCompletionItem(item: proto.CompletionItem): protocolCompletionItem {
        const result = new protocolCompletionItem(item.label);
        if (item.detail) {
            result.detail = item.detail;
        }
        if (item.documentation) {
            result.documentation = item.documentation.toString();
            result.documentationFormat = '$string';
        }
        if (item.filterText) {
            result.filterText = item.filterText;
        }
        const insertText = this.asCompletionInsertText(item);
        if (insertText) {
            result.insertText = insertText.text;
            result.range = insertText.range;
            result.fromEdit = insertText.fromEdit;
        }
        if (typeof item.kind === 'number') {
            const [itemKind, original] = this.asCompletionItemKind(item.kind);
            result.kind = itemKind;
            if (original) {
                result.originalItemKind = original;
            }
        }
        if (item.sortText) {
            result.sortText = item.sortText;
        }
        if (item.additionalTextEdits) {
            result.additionalTextEdits = this.asTextEdits(item.additionalTextEdits);
        }
        if (this.isStringArray(item.commitCharacters)) {
            result.commitCharacters = item.commitCharacters.slice();
        }
        if (item.command) {
            result.command = this.asCommand(item.command);
        }
        if (item.deprecated === true || item.deprecated === false) {
            result.deprecated = item.deprecated;
        }
        if (item.preselect === true || item.preselect === false) {
            result.preselect = item.preselect;
        }
        if (item.data !== undefined) {
            result.data = item.data;
        }
        return result;
    }
    public asTextEdit(edit: null | undefined): undefined;
    public asTextEdit(edit: proto.TextEdit): code.TextEdit;
    public asTextEdit(edit: proto.TextEdit | null | undefined): code.TextEdit | undefined;
    public asTextEdit(_edit: any): any {
        throw new Error('Method not implemented.');
    }
    public asTextEdits(items: proto.TextEdit[]): code.TextEdit[];
    public asTextEdits(items: null | undefined): undefined;
    public asTextEdits(items: proto.TextEdit[] | null | undefined): code.TextEdit[] | undefined;
    public asTextEdits(_items: any): any {
        throw new Error('Method not implemented.');
    }
    public asSignatureHelp(item: null | undefined): undefined;
    public asSignatureHelp(item: proto.SignatureHelp): code.SignatureHelp;
    public asSignatureHelp(item: proto.SignatureHelp | null | undefined): code.SignatureHelp | undefined;
    public asSignatureHelp(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asSignatureInformation(_item: proto.SignatureInformation): code.SignatureInformation {
        throw new Error('Method not implemented.');
    }
    public asSignatureInformations(_items: proto.SignatureInformation[]): code.SignatureInformation[] {
        throw new Error('Method not implemented.');
    }
    public asParameterInformation(_item: proto.ParameterInformation): code.ParameterInformation {
        throw new Error('Method not implemented.');
    }
    public asParameterInformations(_item: proto.ParameterInformation[]): code.ParameterInformation[] {
        throw new Error('Method not implemented.');
    }
    public asLocation(item: proto.Location): code.Location;
    public asLocation(item: null | undefined): undefined;
    public asLocation(item: proto.Location | null | undefined): code.Location | undefined;
    public asLocation(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asDeclarationResult(item: proto.Declaration): code.Location | code.Location[];
    public asDeclarationResult(item: proto.LocationLink[]): code.LocationLink[];
    public asDeclarationResult(item: null | undefined): undefined;
    public asDeclarationResult(
        item: proto.Location | proto.Location[] | proto.LocationLink[] | null | undefined
    ): code.Location | code.Location[] | code.LocationLink[] | undefined;
    public asDeclarationResult(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asDefinitionResult(item: proto.Definition): code.Definition;
    public asDefinitionResult(item: proto.LocationLink[]): code.LocationLink[];
    public asDefinitionResult(item: null | undefined): undefined;
    public asDefinitionResult(
        item: proto.Location | proto.LocationLink[] | proto.Location[] | null | undefined
    ): code.Location | code.LocationLink[] | code.Location[] | undefined;
    public asDefinitionResult(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asReferences(values: proto.Location[]): code.Location[];
    public asReferences(values: null | undefined): code.Location[] | undefined;
    public asReferences(values: proto.Location[] | null | undefined): code.Location[] | undefined;
    public asReferences(_values: any): any {
        throw new Error('Method not implemented.');
    }
    public asDocumentHighlightKind(_item: number): code.DocumentHighlightKind {
        throw new Error('Method not implemented.');
    }
    public asDocumentHighlight(_item: proto.DocumentHighlight): code.DocumentHighlight {
        throw new Error('Method not implemented.');
    }
    public asDocumentHighlights(values: proto.DocumentHighlight[]): code.DocumentHighlight[];
    public asDocumentHighlights(values: null | undefined): undefined;
    public asDocumentHighlights(
        values: proto.DocumentHighlight[] | null | undefined
    ): code.DocumentHighlight[] | undefined;
    public asDocumentHighlights(_values: any): any {
        throw new Error('Method not implemented.');
    }
    public asSymbolInformation(_item: proto.SymbolInformation, _uri?: code.Uri | undefined): code.SymbolInformation {
        throw new Error('Method not implemented.');
    }
    public asSymbolInformations(
        values: proto.SymbolInformation[],
        uri?: code.Uri | undefined
    ): code.SymbolInformation[];
    public asSymbolInformations(values: null | undefined, uri?: code.Uri | undefined): undefined;
    public asSymbolInformations(
        values: proto.SymbolInformation[] | null | undefined,
        uri?: code.Uri | undefined
    ): code.SymbolInformation[] | undefined;
    public asSymbolInformations(_values: any, _uri?: any): any {
        throw new Error('Method not implemented.');
    }
    public asDocumentSymbol(_value: proto.DocumentSymbol): code.DocumentSymbol {
        throw new Error('Method not implemented.');
    }
    public asDocumentSymbols(value: null | undefined): undefined;
    public asDocumentSymbols(value: proto.DocumentSymbol[]): code.DocumentSymbol[];
    public asDocumentSymbols(value: proto.DocumentSymbol[] | null | undefined): code.DocumentSymbol[] | undefined;
    public asDocumentSymbols(_value: any): any {
        throw new Error('Method not implemented.');
    }
    public asCommand(_item: proto.Command): code.Command {
        throw new Error('Method not implemented.');
    }
    public asCommands(items: proto.Command[]): code.Command[];
    public asCommands(items: null | undefined): undefined;
    public asCommands(items: proto.Command[] | null | undefined): code.Command[] | undefined;
    public asCommands(_items: any): any {
        throw new Error('Method not implemented.');
    }
    public asCodeAction(item: proto.CodeAction): code.CodeAction;
    public asCodeAction(item: null | undefined): undefined;
    public asCodeAction(item: proto.CodeAction | null | undefined): code.CodeAction | undefined;
    public asCodeAction(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asCodeActionKind(item: null | undefined): undefined;
    public asCodeActionKind(item: string): code.CodeActionKind;
    public asCodeActionKind(item: string | null | undefined): code.CodeActionKind | undefined;
    public asCodeActionKind(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asCodeActionKinds(item: null | undefined): undefined;
    public asCodeActionKinds(items: string[]): code.CodeActionKind[];
    public asCodeActionKinds(item: string[] | null | undefined): code.CodeActionKind[] | undefined;
    public asCodeActionKinds(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asCodeLens(item: proto.CodeLens): code.CodeLens;
    public asCodeLens(item: null | undefined): undefined;
    public asCodeLens(item: proto.CodeLens | null | undefined): code.CodeLens | undefined;
    public asCodeLens(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asCodeLenses(items: proto.CodeLens[]): code.CodeLens[];
    public asCodeLenses(items: null | undefined): undefined;
    public asCodeLenses(items: proto.CodeLens[] | null | undefined): code.CodeLens[] | undefined;
    public asCodeLenses(_items: any): any {
        throw new Error('Method not implemented.');
    }
    public asWorkspaceEdit(item: proto.WorkspaceEdit): code.WorkspaceEdit;
    public asWorkspaceEdit(item: null | undefined): undefined;
    public asWorkspaceEdit(item: proto.WorkspaceEdit | null | undefined): code.WorkspaceEdit | undefined;
    public asWorkspaceEdit(_item: any): any {
        throw new Error('Method not implemented.');
    }
    public asDocumentLink(_item: proto.DocumentLink): code.DocumentLink {
        throw new Error('Method not implemented.');
    }
    public asDocumentLinks(items: proto.DocumentLink[]): code.DocumentLink[];
    public asDocumentLinks(items: null | undefined): undefined;
    public asDocumentLinks(items: proto.DocumentLink[] | null | undefined): code.DocumentLink[] | undefined;
    public asDocumentLinks(_items: any): any {
        throw new Error('Method not implemented.');
    }
    public asColor(_color: proto.Color): code.Color {
        throw new Error('Method not implemented.');
    }
    public asColorInformation(_ci: proto.ColorInformation): code.ColorInformation {
        throw new Error('Method not implemented.');
    }
    public asColorInformations(colorPresentations: proto.ColorInformation[]): code.ColorInformation[];
    public asColorInformations(colorPresentations: null | undefined): undefined;
    public asColorInformations(colorInformation: proto.ColorInformation[] | null | undefined): code.ColorInformation[];
    public asColorInformations(_colorInformation: any): any {
        throw new Error('Method not implemented.');
    }
    public asColorPresentation(_cp: proto.ColorPresentation): code.ColorPresentation {
        throw new Error('Method not implemented.');
    }
    public asColorPresentations(colorPresentations: proto.ColorPresentation[]): code.ColorPresentation[];
    public asColorPresentations(colorPresentations: null | undefined): undefined;
    public asColorPresentations(colorPresentations: proto.ColorPresentation[] | null | undefined): undefined;
    public asColorPresentations(_colorPresentations: any): any {
        throw new Error('Method not implemented.');
    }
    public asFoldingRangeKind(_kind: string | undefined): code.FoldingRangeKind | undefined {
        throw new Error('Method not implemented.');
    }
    public asFoldingRange(_r: proto.FoldingRange): code.FoldingRange {
        throw new Error('Method not implemented.');
    }
    public asFoldingRanges(foldingRanges: proto.FoldingRange[]): code.FoldingRange[];
    public asFoldingRanges(foldingRanges: null | undefined): undefined;
    public asFoldingRanges(foldingRanges: proto.FoldingRange[] | null | undefined): code.FoldingRange[] | undefined;
    public asFoldingRanges(foldingRanges: proto.FoldingRange[] | null | undefined): code.FoldingRange[] | undefined;
    public asFoldingRanges(_foldingRanges: any): any {
        throw new Error('Method not implemented.');
    }

    private asCompletionItemKind(
        value: proto.CompletionItemKind
    ): [code.CompletionItemKind, proto.CompletionItemKind | undefined] {
        // Protocol item kind is 1 based, codes item kind is zero based.
        if (proto.CompletionItemKind.Text <= value && value <= proto.CompletionItemKind.TypeParameter) {
            return [value - 1, undefined];
        }
        return [code.CompletionItemKind.Text, value];
    }

    private isStringArray(value: any): value is string[] {
        return Array.isArray(value) && (<any[]>value).every(elem => typeof elem === 'string');
    }

    private asCompletionInsertText(
        item: proto.CompletionItem
    ): { text: string | code.SnippetString; range?: code.Range; fromEdit: boolean } | undefined {
        if (item.textEdit) {
            if (item.insertTextFormat === proto.InsertTextFormat.Snippet) {
                return {
                    text: new code.SnippetString(item.textEdit.newText),
                    range: this.asRange(item.textEdit.range),
                    fromEdit: true
                };
            } else {
                return { text: item.textEdit.newText, range: this.asRange(item.textEdit.range), fromEdit: true };
            }
        } else if (item.insertText) {
            if (item.insertTextFormat === proto.InsertTextFormat.Snippet) {
                return { text: new code.SnippetString(item.insertText), fromEdit: false };
            } else {
                return { text: item.insertText, fromEdit: false };
            }
        } else {
            return undefined;
        }
    }
}
