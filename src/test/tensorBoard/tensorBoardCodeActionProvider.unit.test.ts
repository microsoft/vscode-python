// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as TypeMoq from 'typemoq';
import { mock } from 'ts-mockito';
import { assert } from 'chai';
import { CancellationToken, CodeActionContext, Range } from 'vscode';
import { IExperimentService, IExtensionContext } from '../../client/common/types';
import { ExperimentService } from '../../client/common/experiments/service';
import { TensorBoardCodeActionProvider } from '../../client/tensorBoard/tensorBoardCodeActionProvider';
import { MockDocument } from '../startPage/mockDocument';

suite('TensorBoard code action provider', () => {
    let extensionContext: TypeMoq.IMock<IExtensionContext>;
    let experimentService: IExperimentService;
    let codeActionProvider: TensorBoardCodeActionProvider;
    let range: TypeMoq.IMock<Range>;
    let context: TypeMoq.IMock<CodeActionContext>;
    let token: TypeMoq.IMock<CancellationToken>;

    setup(() => {
        extensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        extensionContext.setup((e) => e.subscriptions).returns(() => []);
        experimentService = mock(ExperimentService);
        codeActionProvider = new TensorBoardCodeActionProvider(extensionContext.object, experimentService);
        range = TypeMoq.Mock.ofType<Range>();
        context = TypeMoq.Mock.ofType<CodeActionContext>();
        token = TypeMoq.Mock.ofType<CancellationToken>();
    });

    test('Provides code action for Python files', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import tensorboard', 'foo.py', async (_doc) => true);
        const codeActions = codeActionProvider.provideCodeActions(document, range.object, context.object, token.object);
        assert.ok(
            codeActions.length > 0,
            'Failed to provide code action for Python file containing tensorboard import',
        );
    });
    test('Provides code action for Python ipynbs', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import tensorboard', 'foo.ipynb', async (_doc) => true);
        const codeActions = codeActionProvider.provideCodeActions(document, range.object, context.object, token.object);
        assert.ok(
            codeActions.length > 0,
            'Failed to provide code action for Python ipynb containing tensorboard import',
        );
    });
    test('Does not provide code action if no matching import', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import foo', 'foo.ipynb', async (_doc) => true);
        const codeActions = codeActionProvider.provideCodeActions(document, range.object, context.object, token.object);
        assert.ok(codeActions.length === 0, 'Provided code action for file without tensorboard import');
    });
});
