// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    DecorationOptions,
    EndOfLine,
    Position,
    Range,
    Selection,
    SnippetString,
    TextDocument,
    TextEditor,
    TextEditorDecorationType,
    TextEditorEdit,
    TextEditorOptions,
    TextEditorRevealType,
    ViewColumn
} from 'vscode';

import { noop } from '../../client/common/utils/misc';
import { MockDocument } from './mockDocument';
import { MockDocumentManager } from './mockDocumentManager';

class MockEditorEdit implements TextEditorEdit {
    constructor(private _documentManager: MockDocumentManager, private _document: MockDocument) {}

    public replace(location: Selection | Range | Position, value: string): void {
        this._documentManager.changeDocument(this._document.fileName, [
            {
                range: location as Range,
                newText: value
            }
        ]);
    }

    public insert(location: Position, value: string): void {
        this._documentManager.changeDocument(this._document.fileName, [
            {
                range: new Range(location, location),
                newText: value
            }
        ]);
    }
    public delete(_location: Selection | Range): void {
        throw new Error('Method not implemented.');
    }
    public setEndOfLine(_endOfLine: EndOfLine): void {
        throw new Error('Method not implemented.');
    }
}

export class MockEditor implements TextEditor {
    public selection: Selection;
    public selections: Selection[] = [];
    private _revealCallback: () => void;

    constructor(private _documentManager: MockDocumentManager, private _document: MockDocument) {
        this.selection = new Selection(0, 0, 0, 0);
        this._revealCallback = noop;
    }

    public get document(): TextDocument {
        return this._document;
    }
    public get visibleRanges(): Range[] {
        return [];
    }
    public get options(): TextEditorOptions {
        return {};
    }
    public get viewColumn(): ViewColumn | undefined {
        return undefined;
    }
    public edit(callback: (editBuilder: TextEditorEdit) => void, _options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined): Thenable<boolean> {
        return new Promise(r => {
            const editor = new MockEditorEdit(this._documentManager, this._document);
            callback(editor);
            r(true);
        });
    }
    public insertSnippet(
        _snippet: SnippetString,
        _location?: Range | Position | Range[] | Position[] | undefined,
        _options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined
    ): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }
    public setDecorations(_decorationType: TextEditorDecorationType, _rangesOrOptions: Range[] | DecorationOptions[]): void {
        throw new Error('Method not implemented.');
    }
    public revealRange(_range: Range, _revealType?: TextEditorRevealType | undefined): void {
        this._revealCallback();
    }
    public show(_column?: ViewColumn | undefined): void {
        throw new Error('Method not implemented.');
    }
    public hide(): void {
        throw new Error('Method not implemented.');
    }

    public setRevealCallback(callback: () => void) {
        this._revealCallback = callback;
    }
}
