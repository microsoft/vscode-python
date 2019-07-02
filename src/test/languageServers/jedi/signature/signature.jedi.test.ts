// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'signature');

class SignatureTest {
    public position: vscode.Position;
    public expected: vscode.SignatureHelp;
    constructor(
        line: number,
        column: number,
        activeSignature: number,
        activeParameter: number,
        sigParams: string[][]
    ) {
        this.position = new vscode.Position(line, column);

        this.expected = new vscode.SignatureHelp();
        this.expected.signatures = [];
        if (sigParams.length === 0) {
            return;
        }
        this.expected.activeSignature = activeSignature;
        this.expected.activeParameter = activeParameter;
        for (const params of sigParams) {
            const sig = new vscode.SignatureInformation('');
            sig.parameters = [];
            for (const param of params) {
                sig.parameters.push(
                    new vscode.ParameterInformation(param)
                );
            }
            this.expected.signatures.push(sig);
        }
    }

    public resolveExpected(actual: vscode.SignatureHelp): vscode.SignatureHelp {
        const expected = new vscode.SignatureHelp();
        expected.activeSignature = this.expected.activeSignature;
        expected.activeParameter = this.expected.activeParameter;

        expected.signatures = [];
        for (let i = 0; i < actual.signatures.length; i += 1) {
            if (i === this.expected.signatures.length) {
                break;
            }
            const actualSig = actual.signatures[i];
            const newSig = new vscode.SignatureInformation(
                actualSig.label,
                actualSig.documentation
            );

            newSig.parameters = [];
            for (let j = 0; j < actualSig.parameters.length; j += 1) {
                if (j === this.expected.signatures[i].parameters.length) {
                    break;
                }
                newSig.parameters.push(new vscode.ParameterInformation(
                    this.expected.signatures[i].parameters[j].label,
                    actualSig.parameters[j].documentation
                ));
            }
            expected.signatures.push(newSig);
        }

        return expected;
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Signatures (Jedi)', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(async () => {
        await initialize();
        initializeDI();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await ioc.dispose();
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    test('For ctor', async () => {
        const tests = [
            new SignatureTest(5, 11, -1, -1, []),
            new SignatureTest(5, 12, 0, 0, [['name']]),
            new SignatureTest(5, 13, -1, -1, []),
            new SignatureTest(5, 14, -1, -1, []),
            new SignatureTest(5, 15, -1, -1, []),
            new SignatureTest(5, 16, -1, -1, []),
            new SignatureTest(5, 17, -1, -1, []),
            new SignatureTest(5, 18, 0, 1, [['age']]),
            new SignatureTest(5, 19, 0, 1, [['age']]),
            new SignatureTest(5, 20, -1, -1, [])
        ];

        const document = await openDocument(path.join(autoCompPath, 'classCtor.py'));
        //for (let i = 0; i < tests.length; i += 1) {
        //    const test = tests[i];
        for (const testInfo of tests) {
            const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>(
                'vscode.executeSignatureHelpProvider',
                document!.uri,
                testInfo.position);

            assert.notEqual(actual, undefined, 'command broke');
            const expected = testInfo.resolveExpected(actual!);
            assert.deepEqual(actual!, expected,
                             `case (${testInfo.position.line}, ${testInfo.position.character})`);
        }
    });

    test('For intrinsic', async () => {
        // Note that Python's "range()" has an unorthodox signature.
        const tests = [
            new SignatureTest(0, 0, -1, -1, []),
            new SignatureTest(0, 1, -1, -1, []),
            new SignatureTest(0, 2, -1, -1, []),
            new SignatureTest(0, 3, -1, -1, []),
            new SignatureTest(0, 4, -1, -1, []),
            new SignatureTest(0, 5, -1, -1, []),
            new SignatureTest(0, 6, 0, 0, [['start', 'stop', 'step'], ['stop']]),
            new SignatureTest(0, 7, 0, 0, [['start', 'stop', 'step'], ['stop']])
        ];

        const document = await openDocument(path.join(autoCompPath, 'basicSig.py'));
        for (const testInfo of tests) {
            const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>(
                'vscode.executeSignatureHelpProvider',
                document!.uri,
                testInfo.position);

            assert.notEqual(actual, undefined, 'command broke');
            const expected = testInfo.resolveExpected(actual!);
            assert.deepEqual(actual!, expected,
                             `case (${testInfo.position.line}, ${testInfo.position.character})`);
        }
    });

    test('For ellipsis', async () => {
        // print() no longer has ellipsis (from Jedi).
        // Jedi treats the *args as a single parameter, "values".
        const params = ['values', 'sep', 'end', 'file', 'flush'];
        const tests = [
            new SignatureTest(0, 5, -1, -1, []),
            new SignatureTest(0, 6,  0, 0, [params]),
            new SignatureTest(0, 7,  0, 0, [params]),
            new SignatureTest(0, 8,  0, 0, [params]),
            new SignatureTest(0, 9,  0, 0, [params]),
            new SignatureTest(0, 10, 0, 0, [params]),
            new SignatureTest(0, 11, 0, 0, [params]),
            new SignatureTest(0, 12, 0, 0, [params]),
            new SignatureTest(0, 13, 0, 0, [params]),
            new SignatureTest(0, 14, 0, 0, [params]),
            new SignatureTest(0, 15, 0, 0, [params]),
            new SignatureTest(0, 16, 0, 0, [params]),
            new SignatureTest(0, 17, 0, 0, [params]),
            new SignatureTest(0, 18, 0, 0, [params]),
            new SignatureTest(0, 19, 0, 1, [params])
        ];

        const document = await openDocument(path.join(autoCompPath, 'ellipsis.py'));
        for (const testInfo of tests) {
            const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>(
                'vscode.executeSignatureHelpProvider',
                document!.uri,
                testInfo.position);

            assert.notEqual(actual, undefined, 'command broke');
            const expected = testInfo.resolveExpected(actual!);
            assert.deepEqual(actual!, expected,
                             `case (${testInfo.position.line}, ${testInfo.position.character})`);
        }
    });

    test('For pow', async () => {
        const testInfo = new SignatureTest(0, 4, 0, 0, [
            ['x', 'y', 'z'],
            ['x', 'y', 'z'],
            ['x', 'y', 'z'],
            ['x', 'y', 'z']
            ]);
        const document = await openDocument(path.join(autoCompPath, 'noSigPy3.py'));

        const actual = await vscode.commands.executeCommand<vscode.SignatureHelp>(
            'vscode.executeSignatureHelpProvider',
            document!.uri,
            testInfo.position);

        assert.notEqual(actual, undefined, 'command broke');
        const expected = testInfo.resolveExpected(actual!);
        assert.deepEqual(actual!, expected,
                         `case (${testInfo.position.line}, ${testInfo.position.character})`);
    });
});

async function openDocument(documentPath: string): Promise<vscode.TextDocument | undefined> {
    const document = await vscode.workspace.openTextDocument(documentPath);
    await vscode.window.showTextDocument(document!);
    return document;
}
