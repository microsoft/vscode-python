// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { execPythonFile } from '../../client/common/utils';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'signature');

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
    let isPython3: Promise<boolean>;
    suiteSetup(async () => {
        await initialize();
        const version = await execPythonFile(rootWorkspaceUri, PythonSettings.getInstance(rootWorkspaceUri).pythonPath, ['--version'], __dirname, true);
        isPython3 = Promise.resolve(version.indexOf('3.') >= 0);
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

        const document = await openDocument(path.join(autoCompPath, 'classCtor.py'));
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

        const document = await openDocument(path.join(autoCompPath, 'basicSig.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For ellipsis', async () => {
        if (!await isPython3) {
            return;
        }
        const expected = [
            new SignatureHelpResult(0, 5, 0, 0, null),
            new SignatureHelpResult(0, 6, 1, 0, 'value'),
            new SignatureHelpResult(0, 7, 1, 0, 'value'),
            new SignatureHelpResult(0, 8, 1, 1, '...'),
            new SignatureHelpResult(0, 9, 1, 1, '...'),
            new SignatureHelpResult(0, 10, 1, 1, '...'),
            new SignatureHelpResult(0, 11, 1, 2, 'sep'),
            new SignatureHelpResult(0, 12, 1, 2, 'sep')
        ];

        const document = await openDocument(path.join(autoCompPath, 'ellipsis.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For pow', async () => {
        let expected: SignatureHelpResult;
        if (await isPython3) {
            expected = new SignatureHelpResult(0, 4, 1, 0, null);
        } else {
            expected = new SignatureHelpResult(0, 4, 1, 0, 'x');
        }

        const document = await openDocument(path.join(autoCompPath, 'noSigPy3.py'));
        await checkSignature(expected, document!.uri, 0);
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
        if (expected.parameterName) {
            const parameter = actual!.signatures[0].parameters[expected.activeParameter];
            assert.equal(parameter.label, expected.parameterName, `Parameter name is incorrect, case ${caseIndex}`);
        }
    }
}
