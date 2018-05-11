// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { rootWorkspaceUri } from '../common';
import { IS_ANALYSIS_ENGINE_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

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
suite('Signatures (Analysis Engine)', () => {
    let isPython2: boolean;
    let ioc: UnitTestIocContainer;
    suiteSetup(async function () {
        if (!IS_ANALYSIS_ENGINE_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
        initializeDI();
        isPython2 = await ioc.getPythonMajorVersion(rootWorkspaceUri) === 2;
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        ioc.dispose();
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    test('For ctor', async () => {
        const expected = [
            new SignatureHelpResult(5, 11, 1, -1, null),
            new SignatureHelpResult(5, 12, 1, 0, 'name'),
            new SignatureHelpResult(5, 13, 1, 0, 'name'),
            new SignatureHelpResult(5, 14, 1, 0, 'name'),
            new SignatureHelpResult(5, 15, 1, 0, 'name'),
            new SignatureHelpResult(5, 16, 1, 0, 'name'),
            new SignatureHelpResult(5, 17, 1, 0, 'name'),
            new SignatureHelpResult(5, 18, 1, 1, 'age'),
            new SignatureHelpResult(5, 19, 1, 1, 'age'),
            new SignatureHelpResult(5, 20, 1, -1, null)
        ];

        const document = await openDocument(path.join(autoCompPath, 'classCtor.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For intrinsic', async () => {
        const expected = [
            new SignatureHelpResult(0, 0, 1, -1, null),
            new SignatureHelpResult(0, 1, 1, -1, null),
            new SignatureHelpResult(0, 2, 1, -1, null),
            new SignatureHelpResult(0, 3, 1, -1, null),
            new SignatureHelpResult(0, 4, 1, -1, null),
            new SignatureHelpResult(0, 5, 1, -1, null),
            new SignatureHelpResult(0, 6, 1, 0, 'start'),
            new SignatureHelpResult(0, 7, 1, 0, 'start'),
            new SignatureHelpResult(0, 8, 1, 1, 'stop'),
            new SignatureHelpResult(0, 9, 1, 1, 'stop'),
            new SignatureHelpResult(0, 10, 1, 1, 'stop'),
            new SignatureHelpResult(0, 11, 1, 2, 'step')
        ];

        const document = await openDocument(path.join(autoCompPath, 'basicSig.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For ellipsis', async function () {
        if (isPython2) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
            return;
        }
        const expected = [
            new SignatureHelpResult(0, 5, 1, -1, null),
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
        if (isPython2) {
            expected = new SignatureHelpResult(0, 4, 1, 0, 'x');
        } else {
            expected = new SignatureHelpResult(0, 4, 1, 0, null);
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
