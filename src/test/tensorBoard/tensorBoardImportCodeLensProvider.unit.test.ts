// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { CancellationTokenSource } from 'vscode';
import { TensorBoardImportCodeLensProvider } from '../../client/tensorBoard/tensorBoardImportCodeLensProvider';
import { MockDocument } from '../startPage/mockDocument';

suite('TensorBoard import code lens provider', () => {
    let codeLensProvider: TensorBoardImportCodeLensProvider;
    let cancelTokenSource: CancellationTokenSource;

    setup(() => {
        codeLensProvider = new TensorBoardImportCodeLensProvider([]);
        cancelTokenSource = new CancellationTokenSource();
    });
    teardown(() => {
        cancelTokenSource.dispose();
    });
    ['tensorboard', 'tensorboardX'].forEach((name) => {
        test(`Provides code lens for Python files importing ${name}`, () => {
            const document = new MockDocument(`import ${name}`, 'foo.py', async () => true);
            const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
            assert.ok(codeLens.length > 0, `Failed to provide code lens for file containing ${name} import`);
        });
        test(`Provides code lens for Python ipynbs importing ${name}`, () => {
            const document = new MockDocument(`import ${name}`, 'foo.ipynb', async () => true);
            const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
            assert.ok(codeLens.length > 0, `Failed to provide code lens for ipynb containing ${name} import`);
        });
        test('Fails when cancellation is signaled', () => {
            const document = new MockDocument(`import ${name}`, 'foo.py', async () => true);
            cancelTokenSource.cancel();
            const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
            assert.ok(codeLens.length === 0, 'Provided codelens even after cancellation was requested');
        });
    });
    test('Does not provide code lens if no matching import', () => {
        const document = new MockDocument('import foo', 'foo.ipynb', async () => true);
        const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
        assert.ok(codeLens.length === 0, 'Provided code lens for file without tensorboard import');
    });
});
