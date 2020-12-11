// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { CancellationToken } from 'vscode';
import { ExperimentService } from '../../client/common/experiments/service';
import { IExperimentService } from '../../client/common/types';
import { TensorBoardCodeLensProvider } from '../../client/tensorBoard/tensorBoardCodeLensProvider';
import { MockDocument } from '../startPage/mockDocument';

suite('TensorBoard code lens provider', () => {
    let experimentService: IExperimentService;
    let codeLensProvider: TensorBoardCodeLensProvider;
    let token: TypeMoq.IMock<CancellationToken>;

    setup(() => {
        experimentService = mock(ExperimentService);
        codeLensProvider = new TensorBoardCodeLensProvider(experimentService, []);
        token = TypeMoq.Mock.ofType<CancellationToken>();
    });

    test('Provides code lens for Python files', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import tensorboard', 'foo.py', async (_doc) => true);
        const codeActions = codeLensProvider.provideCodeLenses(document, token.object);
        assert.ok(codeActions.length > 0, 'Failed to provide code lens for file containing tensorboard import');
    });
    test('Provides code lens for Python ipynbs', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import tensorboard', 'foo.ipynb', async (_doc) => true);
        const codeActions = codeLensProvider.provideCodeLenses(document, token.object);
        assert.ok(codeActions.length > 0, 'Failed to provide code lens for ipynb containing tensorboard import');
    });
    test('Does not provide code lens if no matching import', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import foo', 'foo.ipynb', async (_doc) => true);
        const codeActions = codeLensProvider.provideCodeLenses(document, token.object);
        assert.ok(codeActions.length === 0, 'Provided code lens for file without tensorboard import');
    });
});
