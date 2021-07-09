// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Position, Range, Uri, Event, Location, TextLine, TextDocument } from 'vscode';

export interface IConcatTextDocument {
    onDidChange: Event<void>;
    isClosed: boolean;
    lineCount: number;
    languageId: string;
    getText(range?: Range): string;
    contains(uri: Uri): boolean;
    offsetAt(position: Position): number;
    positionAt(locationOrOffset: Location | number): Position;
    validateRange(range: Range): Range;
    validatePosition(position: Position): Position;
    locationAt(positionOrRange: Position | Range): Location;
    lineAt(posOrNumber: Position | number): TextLine;
    getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined;
    getComposeDocuments(): TextDocument[];
}

export function score(document: TextDocument, selector: string): number {
    if (selector === '*') {
        return 5;
    }
    if (selector === document.languageId) {
        return 10;
    }
    return 0;
}
