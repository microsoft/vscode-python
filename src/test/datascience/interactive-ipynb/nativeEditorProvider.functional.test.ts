// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { expect } from 'chai';
import { Uri } from 'vscode';
import { CancellationToken } from 'vscode-languageclient/node';
import { NativeEditorNotebookModel } from '../../../client/datascience/notebookStorage/notebookModel';
import { INotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import { INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { concatMultilineString } from '../../../datascience-ui/common';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { DataScienceIocContainer } from '../dataScienceIocContainer';
import { TestNativeEditorProvider } from '../testNativeEditorProvider';

// tslint:disable: max-func-body-length
suite('DataScience - Native Editor Provider', () => {
    let ioc: DataScienceIocContainer;
    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
    });

    function createNotebookProvider() {
        return ioc.get<TestNativeEditorProvider>(INotebookEditorProvider);
    }

    test('Opening a notebook', async () => {
        const provider = createNotebookProvider();
        const n = await provider.open(Uri.file('foo.ipynb'));
        expect(n.file.fsPath).to.be.include('foo.ipynb');
    });

    test('Multiple new notebooks have new names', async () => {
        const provider = createNotebookProvider();
        const n1 = await provider.createNew();
        expect(n1.file.fsPath).to.be.include('Untitled-1');
        const n2 = await provider.createNew();
        expect(n2.file.fsPath).to.be.include('Untitled-2');
    });

    test('Untitled files changing', async () => {
        const provider = createNotebookProvider();
        const n1 = await provider.createNew();
        expect(n1.file.fsPath).to.be.include('Untitled-1');
        await n1.dispose();
        const n2 = await provider.createNew();
        expect(n2.file.fsPath).to.be.include('Untitled-2');
        await n2.dispose();
        const n3 = await provider.createNew();
        expect(n3.file.fsPath).to.be.include('Untitled-3');
    });

    function insertCell(nbm: INotebookModel, index: number, code: string) {
        if (!(nbm instanceof NativeEditorNotebookModel)) {
            throw new Error('Incorrect Model');
        }
        const cell = createEmptyCell(undefined, 1);
        cell.data.source = code;
        return nbm.update({
            source: 'user',
            kind: 'insert',
            oldDirty: nbm.isDirty,
            newDirty: true,
            cell,
            index
        });
    }

    test('Untitled files reopening with changed contents', async () => {
        let provider = createNotebookProvider();
        const n1 = await provider.createNew();
        let cells = n1.model!.getCellsWithId();
        expect(cells).to.be.lengthOf(1);
        insertCell(n1.model!, 0, 'a=1');
        await ioc.get<INotebookStorageProvider>(INotebookStorageProvider).backup(n1.model!, CancellationToken.None);
        const uri = n1.file;

        // Act like a reboot
        provider = createNotebookProvider();
        const n2 = await provider.open(uri);
        cells = n2.model!.getCellsWithId();
        expect(cells).to.be.lengthOf(2);
        expect(concatMultilineString(cells[0].data.source)).to.be.eq('a=1');

        // Act like another reboot but create a new file
        provider = createNotebookProvider();
        const n3 = await provider.createNew();
        cells = n3.model!.getCellsWithId();
        expect(cells).to.be.lengthOf(1);
    });
});
