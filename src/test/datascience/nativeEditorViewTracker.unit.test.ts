// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, Memento, Uri } from 'vscode';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorViewTracker } from '../../client/datascience/interactive-ipynb/nativeEditorViewTracker';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { MockMemento } from '../mocks/mementos';

suite('DataScience - View tracker', () => {
    let editorProvider: INotebookEditorProvider;
    let editor1: INotebookEditor;
    let editor2: INotebookEditor;
    let untitled1: INotebookEditor;
    let memento: Memento;
    let openedList: string[];
    let editorList: INotebookEditor[];
    let openEvent: EventEmitter<INotebookEditor>;
    let closeEvent: EventEmitter<INotebookEditor>;
    const file1 = Uri.file('foo.ipynb');
    const file2 = Uri.file('bar.ipynb');
    const untitledFile = Uri.parse('untitled://untitled.ipynb');
    setup(() => {
        openEvent = new EventEmitter<INotebookEditor>();
        closeEvent = new EventEmitter<INotebookEditor>();
        openedList = [];
        editorList = [];
        editorProvider = mock(NativeEditorProvider);
        when(editorProvider.open(anything())).thenCall((f) => {
            const key = f.toString();
            openedList.push(f.toString());
            if (key === file1.toString()) {
                editorList.push(instance(editor1));
            }
            if (key === file2.toString()) {
                editorList.push(instance(editor2));
            }
            if (key === untitledFile.toString()) {
                editorList.push(instance(untitled1));
            }
            return Promise.resolve();
        });
        when(editorProvider.editors).thenReturn(editorList);
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
        memento = new MockMemento();
    });

    function activate(): Promise<void> {
        const viewTracker = new NativeEditorViewTracker(instance(editorProvider), memento, []);
        return viewTracker.activate();
    }

    function close(editor: INotebookEditor) {
        editorList = editorList.filter((f) => f.file.toString() !== editor.file.toString());
        closeEvent.fire(editor);
    }

    function open(editor: INotebookEditor) {
        editorList.push(editor);
        openEvent.fire(editor);
    }
    test('Open a bunch of editors will reopen after shutdown', async () => {
        await activate();
        open(instance(editor1));
        open(instance(editor2));
        await activate();
        expect(openedList).to.include(file1.toString(), 'First file not opened');
        expect(openedList).to.include(file2.toString(), 'Second file not opened');
    });
    test('Open a bunch of editors and close will not open after shutdown', async () => {
        await activate();
        open(instance(editor1));
        open(instance(editor2));
        close(instance(editor1));
        close(instance(editor2));
        await activate();
        expect(openedList).to.not.include(file1.toString(), 'First file opened');
        expect(openedList).to.not.include(file2.toString(), 'Second file opened');
    });
    test('Untitled files open too', async () => {
        await activate();
        open(instance(untitled1));
        open(instance(editor2));
        await activate();
        expect(openedList).to.include(untitledFile.toString(), 'First file did not open');
        expect(openedList).to.include(file2.toString(), 'Second file did not open');
    });
    test('Opening more than once does not cause more than one open on reactivate', async () => {
        await activate();
        open(instance(editor1));
        open(instance(editor1));
        await activate();
        expect(openedList.length).to.eq(1, 'Wrong length on reopen');
    });
});
