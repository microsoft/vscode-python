// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable-next-line: no-var-requires no-require-imports
import { assert } from 'chai';
import { anyString, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { CryptoUtils } from '../../../client/common/crypto';
import { sleep } from '../../../client/common/utils/async';
import { NotebookModelChange } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    ActiveKernelIdList,
    BaseNotebookModel,
    MaximumKernelIdListSize
} from '../../../client/datascience/notebookStorage/baseModel';
import { NativeEditorNotebookModel } from '../../../client/datascience/notebookStorage/notebookModel';
import { MockMemento } from '../../mocks/mementos';

suite('DataScience - Notebook Storage', () => {
    let globalMemento: MockMemento;
    let crypto: CryptoUtils;
    setup(() => {
        globalMemento = new MockMemento();
        crypto = mock(CryptoUtils);
        when(crypto.createHash(anyString(), 'string')).thenCall((a1, _a2) => a1);
    });

    function createModel(index: number): BaseNotebookModel {
        const fileName = `foo${index}.ipynb`;
        return new NativeEditorNotebookModel(true, Uri.file(fileName), [], globalMemento, instance(crypto));
    }

    function updateModelKernel(model: BaseNotebookModel, id: string) {
        const kernelModel = {
            name: 'foo',
            // tslint:disable-next-line: no-any
            session: {} as any,
            lastActivityTime: new Date(),
            numberOfConnections: 1,
            id
        };
        const change: NotebookModelChange = {
            kind: 'version',
            kernelConnection: {
                kernelModel,
                interpreter: undefined,
                kind: 'connectToLiveKernel'
            },
            oldDirty: false,
            newDirty: true,
            source: 'user'
        };
        model.update(change);
    }

    test('Verify live kernel id is saved', async () => {
        const model = createModel(0);
        updateModelKernel(model, '1');
        const kernelIds = globalMemento.get(ActiveKernelIdList, []);
        assert.equal(kernelIds.length, 1, 'Kernel id not written');
    });
    test('Verify live kernel id maxes out at 40', async () => {
        for (let i = 0; i < MaximumKernelIdListSize + 10; i += 1) {
            const model = createModel(i);
            updateModelKernel(model, `${i}`);
        }
        await sleep(100); // Give it time to update.
        const kernelIds = globalMemento.get(ActiveKernelIdList, []);
        assert.equal(kernelIds.length, MaximumKernelIdListSize, 'Kernel length is too many');
    });
});
