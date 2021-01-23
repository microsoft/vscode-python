// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Position, Selection } from 'vscode';
import { ExperimentService } from '../../client/common/experiments/service';
import { IExperimentService } from '../../client/common/types';
import { TensorBoardCodeActionProvider } from '../../client/tensorBoard/tensorBoardCodeActionProvider';
import { MockDocument } from '../startPage/mockDocument';

suite('TensorBoard code action provider', () => {
    let experimentService: IExperimentService;
    let codeActionProvider: TensorBoardCodeActionProvider;
    let selection: TypeMoq.IMock<Selection>;

    setup(() => {
        experimentService = mock(ExperimentService);
        codeActionProvider = new TensorBoardCodeActionProvider(experimentService, []);
    });

    ['tensorboard', 'tensorboardX'].forEach((name) => {
        test(`Provides code action for ${name} in Python files`, () => {
            const document = new MockDocument(`import foo\nimport ${name}`, 'foo.py', async () => true);
            selection = TypeMoq.Mock.ofType<Selection>();
            selection.setup((s) => s.active).returns(() => new Position(1, 0));
            const codeActions = codeActionProvider.provideCodeActions(document, selection.object);
            assert.ok(
                codeActions.length > 0,
                `Failed to provide code action for Python file containing ${name} import`,
            );
        });
        test(`Provides code action for ${name} in Python ipynbs`, () => {
            const document = new MockDocument(`import ${name}`, 'foo.ipynb', async () => true);
            selection.setup((s) => s.active).returns(() => new Position(0, 0));
            const codeActions = codeActionProvider.provideCodeActions(document, selection.object);
            assert.ok(
                codeActions.length > 0,
                `Failed to provide code action for Python ipynb containing ${name} import`,
            );
        });
        test(`Does not provide code action if cursor is not on line containing ${name} import`, () => {
            const document = new MockDocument(`import foo\nimport ${name}`, 'foo.py', async () => true);
            selection.setup((s) => s.active).returns(() => new Position(0, 0));
            const codeActions = codeActionProvider.provideCodeActions(document, selection.object);
            assert.ok(
                codeActions.length === 0,
                'Provided code action for file even though cursor was not on line containing import',
            );
        });
    });
    test('Does not provide code action if no matching import', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const document = new MockDocument('import foo', 'foo.ipynb', async (_doc) => true);
        selection.setup((s) => s.active).returns(() => new Position(0, 0));
        const codeActions = codeActionProvider.provideCodeActions(document, selection.object);
        assert.ok(codeActions.length === 0, 'Provided code action for file without tensorboard import');
    });
});
