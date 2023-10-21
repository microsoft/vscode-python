// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as sinon from 'sinon';
import { assert } from 'chai';
import { CancellationTokenSource } from 'vscode';
import { instance, mock } from 'ts-mockito';
import { TensorBoardNbextensionCodeLensProvider } from '../../client/tensorBoard/nbextensionCodeLensProvider';
import { MockDocument } from '../mocks/mockDocument';
import { TensorboardExperiment } from '../../client/tensorBoard/tensorboarExperiment';

[true, false].forEach((tbExtensionInstalled) => {
    suite(`Tensorboard Extension is ${tbExtensionInstalled ? 'installed' : 'not installed'}`, () => {
        suite('TensorBoard nbextension code lens provider', () => {
            let experiment: TensorboardExperiment;
            let codeLensProvider: TensorBoardNbextensionCodeLensProvider;
            let cancelTokenSource: CancellationTokenSource;

            setup(() => {
                sinon.stub(TensorboardExperiment, 'isTensorboardExtensionInstalled').returns(tbExtensionInstalled);
                experiment = mock<TensorboardExperiment>();
                codeLensProvider = new TensorBoardNbextensionCodeLensProvider([], instance(experiment));
                cancelTokenSource = new CancellationTokenSource();
            });
            teardown(() => {
                sinon.restore();
                cancelTokenSource.dispose();
            });

            test('Provide code lens for Python notebook loading tensorboard nbextension', async () => {
                const document = new MockDocument('a=1\n%load_ext tensorboard', 'foo.ipynb', async () => true);
                const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
                assert.ok(codeLens.length > 0, 'Failed to provide code lens for file loading tensorboard nbextension');
            });
            test('Provide code lens for Python notebook launching tensorboard nbextension', async () => {
                const document = new MockDocument('a=1\n%tensorboard --logdir logs/fit', 'foo.ipynb', async () => true);
                const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
                assert.ok(codeLens.length > 0, 'Failed to provide code lens for file loading tensorboard nbextension');
            });
            test('Fails when cancellation is signaled', () => {
                const document = new MockDocument('a=1\n%tensorboard --logdir logs/fit', 'foo.ipynb', async () => true);
                cancelTokenSource.cancel();
                const codeLens = codeLensProvider.provideCodeLenses(document, cancelTokenSource.token);
                assert.ok(codeLens.length === 0, 'Provided codelens even after cancellation was requested');
            });
            // Can't verify these cases without running in vscode as we depend on vscode to not call us
            // based on the DocumentSelector we provided. See nbExtensionCodeLensProvider.test.ts for that.
            // test('Does not provide code lens for Python file loading tensorboard nbextension', async () => {
            //     const document = new MockDocument('a=1\n%load_ext tensorboard', 'foo.py', async () => true);
            //     const codeLens = codeLensProvider.provideCodeLenses(document);
            //     assert.ok(codeLens.length === 0, 'Provided code lens for Python file loading tensorboard nbextension');
            // });
            // test('Does not provide code lens for Python file launching tensorboard nbextension', async () => {
            //     const document = new MockDocument('a=1\n%tensorboard --logdir logs/fit', 'foo.py', async () => true);
            //     const codeLens = codeLensProvider.provideCodeLenses(document);
            //     assert.ok(codeLens.length === 0, 'Provided code lens for Python file loading tensorboard nbextension');
            // });
        });
    });
});
