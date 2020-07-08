// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, TextEditor } from 'vscode';
import { NotebookEditor } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IDocumentManager, IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { IInterpreterDisplay, IInterpreterStatusbarVisibilityFilter } from '../../../client/interpreter/contracts';
import { InterpreterStatusbarDisplayManager } from '../../../client/interpreter/display/displayManager';

// tslint:disable:no-any
suite('Interpreters - Interpreter Display Manager', () => {
    let displayManager: IExtensionSingleActivationService;
    let disposables: IDisposable[];
    let onDidChangeActiveTextEditor: EventEmitter<TextEditor | undefined>;
    let onDidChangeActiveNotebookEditor: EventEmitter<NotebookEditor | undefined>;
    let interpreterDisplay: IInterpreterDisplay;
    async function initialize(filters: IInterpreterStatusbarVisibilityFilter[]) {
        const documentManager = mock<IDocumentManager>();
        const vscNotebook = mock<IVSCodeNotebook>();
        interpreterDisplay = mock<IInterpreterDisplay>();
        when(documentManager.onDidChangeActiveTextEditor).thenReturn(onDidChangeActiveTextEditor.event);
        when(vscNotebook.onDidChangeActiveNotebookEditor).thenReturn(onDidChangeActiveNotebookEditor.event);
        displayManager = new InterpreterStatusbarDisplayManager(
            filters,
            instance(interpreterDisplay),
            instance(documentManager),
            instance(vscNotebook),
            disposables
        );
        await displayManager.activate();
    }
    setup(() => {
        disposables = [];
        onDidChangeActiveTextEditor = new EventEmitter<TextEditor | undefined>();
        onDidChangeActiveNotebookEditor = new EventEmitter<NotebookEditor | undefined>();
    });
    teardown(() => {
        disposables.forEach((d) => d.dispose());
    });
    [
        {
            title: 'Change active notebook',
            checkFilters: () => onDidChangeActiveNotebookEditor.fire(mock<NotebookEditor>())
        },
        {
            title: 'No more active notebook',
            checkFilters: () => onDidChangeActiveNotebookEditor.fire(undefined)
        },
        {
            title: 'Change active text editor',
            checkFilters: () => onDidChangeActiveTextEditor.fire(mock<TextEditor>())
        },
        {
            title: 'No more active text editor',
            checkFilters: () => onDidChangeActiveTextEditor.fire(undefined)
        }
    ].forEach((testType) => {
        suite(testType.title, () => {
            test('Does nothing if there are no filters', async () => {
                await initialize([]);

                testType.checkFilters();

                verify(interpreterDisplay.show()).never();
                verify(interpreterDisplay.hide()).never();
            });
            test('Displays statusbar', async () => {
                const filter = mock<IInterpreterStatusbarVisibilityFilter>();
                when(filter.shouldDisplayStatusBar()).thenReturn(true);
                await initialize([instance(filter)]);

                testType.checkFilters();

                verify(interpreterDisplay.show()).once();
                verify(interpreterDisplay.hide()).never();
            });
            test('Displays statusbar if all filters allow this', async () => {
                const filter1 = mock<IInterpreterStatusbarVisibilityFilter>();
                const filter2 = mock<IInterpreterStatusbarVisibilityFilter>();
                when(filter1.shouldDisplayStatusBar()).thenReturn(true);
                when(filter2.shouldDisplayStatusBar()).thenReturn(true);
                await initialize([instance(filter1), instance(filter2)]);

                testType.checkFilters();

                verify(interpreterDisplay.show()).once();
                verify(interpreterDisplay.hide()).never();
            });
            test('Hides statusbar', async () => {
                const filter = mock<IInterpreterStatusbarVisibilityFilter>();
                when(filter.shouldDisplayStatusBar()).thenReturn(false);
                await initialize([instance(filter)]);

                testType.checkFilters();

                verify(interpreterDisplay.show()).never();
                verify(interpreterDisplay.hide()).once();
            });
            test('Hides statusbar if one filters requires it to be hidden', async () => {
                const filter1 = mock<IInterpreterStatusbarVisibilityFilter>();
                const filter2 = mock<IInterpreterStatusbarVisibilityFilter>();
                when(filter1.shouldDisplayStatusBar()).thenReturn(true);
                when(filter2.shouldDisplayStatusBar()).thenReturn(false);
                await initialize([instance(filter1), instance(filter2)]);

                testType.checkFilters();

                verify(interpreterDisplay.show()).never();
                verify(interpreterDisplay.hide()).once();
            });
        });
    });
});
