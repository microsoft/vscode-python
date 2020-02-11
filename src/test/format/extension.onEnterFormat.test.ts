// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { CancellationTokenSource, Position, TextDocument, workspace } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { OnEnterFormatter } from '../../client/typeFormatters/onEnterFormatter';
import { closeActiveWindows, initialize } from '../initialize';

const formatFilesPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'formatting');
const unformattedFile = path.join(formatFilesPath, 'fileToFormatOnEnter.py');

suite('Formatting - OnEnter provider', () => {
    let document: TextDocument;
    let formatter: OnEnterFormatter;
    suiteSetup(async () => {
        await initialize();
        document = await workspace.openTextDocument(unformattedFile);
        formatter = new OnEnterFormatter();
    });
    suiteTeardown(closeActiveWindows);

    test('Simple statement', () => testFormattingAtPosition(1, 0, 'x = 1'));

    test('No formatting inside strings (2)', () => doesNotFormat(2, 0));

    test('No formatting inside strings (3)', () => doesNotFormat(3, 0));

    test('Whitespace before comment', () => doesNotFormat(4, 0));

    test('No formatting of comment', () => doesNotFormat(5, 0));

    test('Formatting line ending in comment', () => testFormattingAtPosition(6, 0, 'x + 1  # '));

    test('Formatting line with @', () => doesNotFormat(7, 0));

    test('Formatting line with @', () => doesNotFormat(8, 0));

    test('Formatting line with unknown neighboring tokens', () => testFormattingAtPosition(9, 0, 'if x <= 1:'));

    test('Formatting line with unknown neighboring tokens', () => testFormattingAtPosition(10, 0, 'if 1 <= x:'));

    test('Formatting method definition with arguments', () =>
        testFormattingAtPosition(11, 0, 'def __init__(self, age=23)'));

    test('Formatting space after open brace', () => testFormattingAtPosition(12, 0, 'while (1)'));

    test('Formatting line ending in string', () => testFormattingAtPosition(13, 0, 'x + """'));

    function testFormattingAtPosition(line: number, character: number, expectedFormattedString?: string): void {
        const token = new CancellationTokenSource().token;
        const edits = formatter.provideOnTypeFormattingEdits(
            document,
            new Position(line, character),
            '\n',
            { insertSpaces: true, tabSize: 2 },
            token
        );
        expect(edits).to.be.lengthOf(1);
        expect(edits[0].newText).to.be.equal(expectedFormattedString);
    }
    function doesNotFormat(line: number, character: number): void {
        const token = new CancellationTokenSource().token;
        const edits = formatter.provideOnTypeFormattingEdits(
            document,
            new Position(line, character),
            '\n',
            { insertSpaces: true, tabSize: 2 },
            token
        );
        expect(edits).to.be.lengthOf(0);
    }
});
