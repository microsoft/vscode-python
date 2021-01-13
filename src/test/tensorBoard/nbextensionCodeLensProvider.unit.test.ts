// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { mock } from 'ts-mockito';
import { ExperimentService } from '../../client/common/experiments/service';
import { IExperimentService } from '../../client/common/types';
import { TensorBoardNbextensionCodeLensProvider } from '../../client/tensorBoard/nbextensionCodeLensProvider';
import { MockDocument } from '../startPage/mockDocument';

suite('TensorBoard nbextension code lens provider', () => {
    let experimentService: IExperimentService;
    let codeLensProvider: TensorBoardNbextensionCodeLensProvider;

    setup(() => {
        experimentService = mock(ExperimentService);
        codeLensProvider = new TensorBoardNbextensionCodeLensProvider(experimentService, []);
    });

    test('Provide code lens for Python notebook loading tensorboard nbextension', async () => {
        const document = new MockDocument('a=1\n%load_ext tensorboard', 'foo.ipynb', async () => true);
        const codeActions = codeLensProvider.provideCodeLenses(document);
        assert.ok(codeActions.length > 0, 'Failed to provide code lens for file loading tensorboard nbextension');
    });
    test('Provide code lens for Python notebook launching tensorboard nbextension', async () => {
        const document = new MockDocument('a=1\n%tensorboard --logdir logs/fit', 'foo.ipynb', async () => true);
        const codeActions = codeLensProvider.provideCodeLenses(document);
        assert.ok(codeActions.length > 0, 'Failed to provide code lens for file loading tensorboard nbextension');
    });
    // Can't verify these cases without running in vscode as we depend on vscode to not call us
    // based on the DocumentSelector we provided. See nbExtensionCodeLensProvider.test.ts for that.
    // test('Does not provide code lens for Python file loading tensorboard nbextension', async () => {
    //     const document = new MockDocument('a=1\n%load_ext tensorboard', 'foo.py', async () => true);
    //     const codeActions = codeLensProvider.provideCodeLenses(document);
    //     assert.ok(codeActions.length === 0, 'Provided code lens for Python file loading tensorboard nbextension');
    // });
    // test('Does not provide code lens for Python file launching tensorboard nbextension', async () => {
    //     const document = new MockDocument('a=1\n%tensorboard --logdir logs/fit', 'foo.py', async () => true);
    //     const codeActions = codeLensProvider.provideCodeLenses(document);
    //     assert.ok(codeActions.length === 0, 'Provided code lens for Python file loading tensorboard nbextension');
    // });
});
