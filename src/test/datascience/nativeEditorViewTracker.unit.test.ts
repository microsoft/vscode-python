// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorViewTracker } from '../../client/datascience/interactive-ipynb/nativeEditorViewTracker';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { MockMemento } from '../mocks/mementos';

suite('DataScience - View tracker', () => {
    let viewTracker: NativeEditorViewTracker;
    let editorProvider: INotebookEditorProvider;
    let editor1: INotebookEditor;
    let editor2: INotebookEditor;
    let untitled1: INotebookEditor;
    let openedList: Uri[];
    let openEvent: EventEmitter<INotebookEditor>;
    let closeEvent: EventEmitter<INotebookEditor>;
    const file1 = Uri.file('foo.ipynb');
    const file2 = Uri.file('bar.ipynb');
    const untitledFile = Uri.parse('untitled://untitled.ipynb');
    setup(() => {
        openEvent = new EventEmitter<INotebookEditor>();
        closeEvent = new EventEmitter<INotebookEditor>();
        openedList = [];
        editorProvider = mock(NativeEditorProvider);
        when(editorProvider.open(anything())).thenCall((f) => {
            openedList.push(f);
            return Promise.resolve();
        });
        when(editorProvider.onDidCloseNotebookEditor).thenReturn(closeEvent.event);
        when(editorProvider.onDidOpenNotebookEditor).thenReturn(openEvent.event);
        editor1 = mock(NativeEditor);
        when(editor1.file).thenReturn(file1);
        editor2 = mock(NativeEditor);
        when(editor2.file).thenReturn(file2);
        editor1 = mock(NativeEditor);
        when(editor1.file).thenReturn(file1);
        untitled1 = mock(NativeEditor);
        when(untitled1.file).thenReturn(untitledFile);
        const memento = new MockMemento();
        viewTracker = new NativeEditorViewTracker(instance(editorProvider), memento, []);
    });
    test('Open a bunch of editors will reopen after shutdown', async () => {
        await viewTracker.activate();
        openEvent.fire(instance(editor1));
        openEvent.fire(instance(editor2));
        await viewTracker.activate();
        expect(openedList).to.include(file1, 'First file not opened');
        expect(openedList).to.include(file2, 'Second file not opened');
    });
    test('Open a bunch of editors and close will not open after shutdown', async () => {
        await viewTracker.activate();
        openEvent.fire(instance(editor1));
        openEvent.fire(instance(editor2));
        closeEvent.fire(instance(editor1));
        closeEvent.fire(instance(editor2));
        await viewTracker.activate();
        expect(openedList).to.not.include(file1, 'First file opened');
        expect(openedList).to.not.include(file2, 'Second file opened');
    });
    test('Untitled files open too', async () => {
        await viewTracker.activate();
        openEvent.fire(instance(untitled1));
        openEvent.fire(instance(editor2));
        await viewTracker.activate();
        expect(openedList).to.include(untitled1, 'First file did not open');
        expect(openedList).to.include(file2, 'Second file did not open');
    });
});
