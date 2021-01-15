// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { rootWorkspaceUri } from '../../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'signature');

class SignatureHelpResult {
    constructor(
        public line: number,
        public index: number,
        public signaturesCount: number,
        public activeParameter: number,
        public parameterName: string | null,
    ) {}
}

suite('Language Server: Signatures (Jedi)', () => {
    let isPython2: boolean;
    let ioc: UnitTestIocContainer;
    suiteSetup(async () => {
        await initialize();
        await initializeDI();
        isPython2 = (await ioc.getPythonMajorVersion(rootWorkspaceUri!)) === 2;
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await ioc.dispose();
    });
    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        ioc.registerInterpreterStorageTypes();
        await ioc.registerMockInterpreterTypes();
    }

    test('For ctor', async () => {
        const expected = [
            new SignatureHelpResult(5, 11, 0, 0, null),
            new SignatureHelpResult(5, 12, 1, 0, 'name'),
            new SignatureHelpResult(5, 13, 0, 0, null),
            new SignatureHelpResult(5, 14, 0, 0, null),
            new SignatureHelpResult(5, 15, 0, 0, null),
            new SignatureHelpResult(5, 16, 0, 0, null),
            new SignatureHelpResult(5, 17, 0, 0, null),
            new SignatureHelpResult(5, 18, 1, 1, 'age'),
            new SignatureHelpResult(5, 19, 1, 1, 'age'),
            new SignatureHelpResult(5, 20, 0, 0, null),
        ];

        const document = await openDocument(path.join(autoCompPath, 'classCtor.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For intrinsic', async () => {
        let expected: SignatureHelpResult[];
        if (isPython2) {
            expected = [
                new SignatureHelpResult(0, 0, 0, 0, null),
                new SignatureHelpResult(0, 1, 0, 0, null),
                new SignatureHelpResult(0, 2, 0, 0, null),
                new SignatureHelpResult(0, 3, 0, 0, null),
                new SignatureHelpResult(0, 4, 0, 0, null),
                new SignatureHelpResult(0, 5, 0, 0, null),
                new SignatureHelpResult(0, 6, 1, 0, 'x'),
                new SignatureHelpResult(0, 7, 1, 0, 'x'),
            ];
        } else {
            expected = [
                new SignatureHelpResult(0, 0, 0, 0, null),
                new SignatureHelpResult(0, 1, 0, 0, null),
                new SignatureHelpResult(0, 2, 0, 0, null),
                new SignatureHelpResult(0, 3, 0, 0, null),
                new SignatureHelpResult(0, 4, 0, 0, null),
                new SignatureHelpResult(0, 5, 0, 0, null),
                new SignatureHelpResult(0, 6, 2, 0, 'stop'),
                new SignatureHelpResult(0, 7, 2, 0, 'stop'),
                // new SignatureHelpResult(0, 6, 1, 0, 'start'),
                // new SignatureHelpResult(0, 7, 1, 0, 'start'),
                // new SignatureHelpResult(0, 8, 1, 1, 'stop'),
                // new SignatureHelpResult(0, 9, 1, 1, 'stop'),
                // new SignatureHelpResult(0, 10, 1, 1, 'stop'),
                // new SignatureHelpResult(0, 11, 1, 2, 'step'),
                // new SignatureHelpResult(1, 0, 1, 2, 'step')
            ];
        }

        const document = await openDocument(path.join(autoCompPath, 'basicSig.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For ellipsis', async function () {
        if (isPython2) {
            return this.skip();
        }
        const expected = [
            new SignatureHelpResult(0, 5, 0, 0, null),
            new SignatureHelpResult(0, 6, 1, 0, 'values'),
            new SignatureHelpResult(0, 7, 1, 0, 'values'),
            new SignatureHelpResult(0, 8, 1, 0, 'values'),
            new SignatureHelpResult(0, 9, 1, 0, 'values'),
            new SignatureHelpResult(0, 10, 1, 0, 'values'),
            new SignatureHelpResult(0, 11, 1, 0, 'values'),
            new SignatureHelpResult(0, 12, 1, 0, 'values'),
        ];

        const document = await openDocument(path.join(autoCompPath, 'ellipsis.py'));
        for (let i = 0; i < expected.length; i += 1) {
            await checkSignature(expected[i], document!.uri, i);
        }
    });

    test('For pow', async () => {
        let expected: SignatureHelpResult;
        if (isPython2) {
            expected = new SignatureHelpResult(0, 4, 4, 0, 'x');
        } else {
            expected = new SignatureHelpResult(0, 4, 4, 0, null);
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
    const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        'vscode.executeSignatureHelpProvider',
        uri,
        position,
    );
    assert.equal(
        actual!.signatures.length,
        expected.signaturesCount,
        `Signature count does not match, case ${caseIndex}`,
    );
    if (expected.signaturesCount > 0) {
        assert.equal(
            actual!.activeParameter,
            expected.activeParameter,
            `Parameter index does not match, case ${caseIndex}`,
        );
        if (expected.parameterName) {
            const parameter = actual!.signatures[0].parameters[expected.activeParameter];
            assert.equal(parameter.label, expected.parameterName, `Parameter name is incorrect, case ${caseIndex}`);
        }
    }
}
