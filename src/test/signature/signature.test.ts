// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { execPythonFile } from '../../client/common/utils';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'signature');
const fileOne = path.join(autoCompPath, 'one.py');
const fileTwo = path.join(autoCompPath, 'two.py');

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
        const version = await execPythonFile(rootWorkspaceUri, PythonSettings.getInstance(rootWorkspaceUri).pythonPath, ['--version'], __dirname, true);
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
        for (const e of expected) {
            await checkSignature(e, document!.uri);
        }
    });

    test('For intrinsic', async () => {
        const expected = [
            new SignatureHelpResult(0, 0, 0, 0, null),
            new SignatureHelpResult(0, 1, 0, 0, null),
            new SignatureHelpResult(0, 2, 0, 0, null),
            new SignatureHelpResult(0, 3, 0, 0, null),
            new SignatureHelpResult(0, 4, 1, 0, 'x'),
            new SignatureHelpResult(0, 5, 1, 0, 'x'),
            new SignatureHelpResult(0, 6, 1, 1, 'y'),
            new SignatureHelpResult(0, 7, 1, 1, 'y'),
            new SignatureHelpResult(0, 8, 1, 1, 'y'),
            new SignatureHelpResult(0, 9, 1, 2, 'z'),
            new SignatureHelpResult(0, 10, 1, 2, 'z'),
            new SignatureHelpResult(1, 0, 1, 2, 'z')
        ];

        const document = await openDocument(fileTwo);
        for (const e of expected) {
            await checkSignature(e, document!.uri);
        }
    });
});

async function openDocument(documentPath: string): Promise<vscode.TextDocument | undefined> {
    const document = await vscode.workspace.openTextDocument(documentPath);
    await vscode.window.showTextDocument(document!);
    return document;
}

async function checkSignature(expected: SignatureHelpResult, uri: vscode.Uri) {
    const position = new vscode.Position(expected.line, expected.index);
    const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>('vscode.executeSignatureHelpProvider', uri, position);
    assert.equal(actual!.signatures.length, expected.signaturesCount);
    if (expected.signaturesCount > 0) {
        assert.equal(actual!.activeParameter, expected.activeParameter);
        const parameter = actual!.signatures[0].parameters[expected.activeParameter];
        assert.equal(parameter.label, expected.parameterName);
    }
}
