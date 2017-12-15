// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'signature');
const fileOne = path.join(autoCompPath, 'one.py');
const fileTwo = path.join(autoCompPath, 'two.py');
const fileThree = path.join(autoCompPath, 'three.py');

class SignatureHelpResult {
    constructor(
        public line: number,
        public index: number,
        public signaturesCount: number,
        public activeParameter: number,
        public parameterName: string | null) { }
}

// tslint:disable-next-line:max-func-body-length
suite('Signatures', () => {
    suiteSetup(async () => {
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('For ctor', async () => {
        const expected = [
            new SignatureHelpResult(5, 11, 0, 0, null),
            new SignatureHelpResult(5, 12, 1, 0, 'name'),
            new SignatureHelpResult(5, 13, 1, 0, 'name'),
            new SignatureHelpResult(5, 14, 1, 0, 'name'),
            new SignatureHelpResult(5, 15, 1, 0, 'name'),
            new SignatureHelpResult(5, 16, 1, 0, 'name'),
            new SignatureHelpResult(5, 17, 1, 0, 'name'),
            new SignatureHelpResult(5, 18, 1, 1, 'age'),
            new SignatureHelpResult(5, 19, 1, 1, 'age'),
            new SignatureHelpResult(5, 20, 0, 0, null)
        ];

        const document = await openDocument(fileOne);
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For intrinsic', async () => {
        const expected = [
            new SignatureHelpResult(0, 0, 0, 0, null),
            new SignatureHelpResult(0, 1, 0, 0, null),
            new SignatureHelpResult(0, 2, 0, 0, null),
            new SignatureHelpResult(0, 3, 0, 0, null),
            new SignatureHelpResult(0, 4, 0, 0, null),
            new SignatureHelpResult(0, 5, 0, 0, null),
            new SignatureHelpResult(0, 6, 1, 0, 'start'),
            new SignatureHelpResult(0, 7, 1, 0, 'start'),
            new SignatureHelpResult(0, 8, 1, 1, 'stop'),
            new SignatureHelpResult(0, 9, 1, 1, 'stop'),
            new SignatureHelpResult(0, 10, 1, 1, 'stop'),
            new SignatureHelpResult(0, 11, 1, 2, 'step'),
            new SignatureHelpResult(1, 0, 1, 2, 'step')
        ];

        const document = await openDocument(fileTwo);
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For ellipsis', async () => {
        const expected = [
            new SignatureHelpResult(0, 4, 0, 0, null),
            new SignatureHelpResult(0, 5, 0, 0, null),
            new SignatureHelpResult(0, 6, 1, 0, 'value'),
            new SignatureHelpResult(0, 7, 1, 0, 'value'),
            new SignatureHelpResult(0, 8, 1, 1, '...'),
            new SignatureHelpResult(0, 9, 1, 1, '...'),
            new SignatureHelpResult(0, 10, 1, 1, '...'),
            new SignatureHelpResult(0, 11, 1, 2, 'sep'),
            new SignatureHelpResult(0, 12, 1, 2, 'sep')
        ];

        const document = await openDocument(fileThree);
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });
});

async function openDocument(documentPath: string): Promise<vscode.TextDocument | undefined> {
    const document = await vscode.workspace.openTextDocument(documentPath);
    await vscode.window.showTextDocument(document!);
    return document;
}

async function checkSignature(expected: SignatureHelpResult, uri: vscode.Uri, caseIndex: number) {
    const position = new vscode.Position(expected.line, expected.index);
    const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>('vscode.executeSignatureHelpProvider', uri, position);
    assert.equal(actual!.signatures.length, expected.signaturesCount, `Signature count does not match, case ${caseIndex}`);
    if (expected.signaturesCount > 0) {
        assert.equal(actual!.activeParameter, expected.activeParameter, `Parameter index does not match, case ${caseIndex}`);
        const parameter = actual!.signatures[0].parameters[expected.activeParameter];
        assert.equal(parameter.label, expected.parameterName, `Parameter name is incorrect, case ${caseIndex}`);
    }
}
