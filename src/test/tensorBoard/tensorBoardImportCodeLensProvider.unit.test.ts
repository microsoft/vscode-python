// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { CancellationTokenSource } from 'vscode';
import { TensorBoardImportCodeLensProvider } from '../../client/tensorBoard/tensorBoardImportCodeLensProvider';
import { MockDocument } from '../mocks/mockDocument';

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
    [
        'import tensorboard',
        'import foo, tensorboard',
        'import foo, tensorboard, bar',
        'import tensorboardX',
        'import tensorboardX, bar',
        'import torch.profiler',
        'import foo, torch.profiler',
        'from torch.utils import tensorboard',
        'from torch.utils import foo, tensorboard',
        'import torch.utils.tensorboard, foo',
        'from torch import profiler',
    ].forEach((importStatement) => {
        test(`Provides code lens for Python files containing ${importStatement}`, () => {
            const document = new MockDocument(importStatement, 'foo.py', async () => true);
            const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
            assert.ok(codeLens.length > 0, `Failed to provide code lens for file containing ${importStatement} import`);
        });
        test(`Provides code lens for Python ipynbs containing ${importStatement}`, () => {
            const document = new MockDocument(importStatement, 'foo.ipynb', async () => true);
            const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
            assert.ok(
                codeLens.length > 0,
                `Failed to provide code lens for ipynb containing ${importStatement} import`,
            );
        });
        test('Fails when cancellation is signaled', () => {
            const document = new MockDocument(importStatement, 'foo.py', async () => true);
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
