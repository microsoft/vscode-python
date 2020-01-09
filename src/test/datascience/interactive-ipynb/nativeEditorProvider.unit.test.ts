// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { EventEmitter, TextDocument, TextEditor, Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { DocumentManager } from '../../../client/common/application/documentManager';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../../client/common/asyncDisposableRegistry';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService } from '../../../client/common/types';
import { DataScienceErrorHandler } from '../../../client/datascience/errorHandler/errorHandler';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { IDataScienceErrorHandler, INotebookEditor } from '../../../client/datascience/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../core';

// tslint:disable: max-func-body-length
suite('Data Science - Native Editor Provider', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: IFileSystem;
    let docManager: IDocumentManager;
    let dsErrorHandler: IDataScienceErrorHandler;
    let cmdManager: ICommandManager;
    let svcContainer: IServiceContainer;
    let changeActiveTextEditorEventEmitter: EventEmitter<TextEditor>;
    let editor: typemoq.IMock<INotebookEditor>;
    let file: Uri;

    setup(() => {
        svcContainer = mock(ServiceContainer);
        configService = mock(ConfigurationService);
        fileSystem = mock(FileSystem);
        docManager = mock(DocumentManager);
        dsErrorHandler = mock(DataScienceErrorHandler);
        cmdManager = mock(CommandManager);
        workspace = mock(WorkspaceService);
        changeActiveTextEditorEventEmitter = new EventEmitter<TextEditor>();
    });

    function createNotebookProvider(shouldOpenNotebookEditor: boolean) {
        editor = typemoq.Mock.ofType<INotebookEditor>();
        when(configService.getSettings()).thenReturn({ datascience: { useNotebookEditor: true } } as any);
        when(docManager.onDidChangeActiveTextEditor).thenReturn(changeActiveTextEditorEventEmitter.event);
        when(docManager.visibleTextEditors).thenReturn([]);
        editor.setup(e => e.closed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup(e => e.executed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup(e => (e as any).then).returns(() => undefined);
        when(svcContainer.get<INotebookEditor>(INotebookEditor)).thenReturn(editor.object);

        // Ensure the editor is created and the load and show methods are invoked.
        const invocationCount = shouldOpenNotebookEditor ? 1 : 0;
        editor
            .setup(e => e.load(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((_a1: string, f: Uri) => {
                file = f;
                return Promise.resolve();
            })
            .verifiable(typemoq.Times.exactly(invocationCount));
        editor
            .setup(e => e.show())
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.exactly(invocationCount));
        editor.setup(e => e.file).returns(() => file);

        return new NativeEditorProvider(
            instance(svcContainer),
            instance(mock(AsyncDisposableRegistry)),
            [],
            instance(workspace),
            instance(configService),
            instance(fileSystem),
            instance(docManager),
            instance(cmdManager),
            instance(dsErrorHandler)
        );
    }
    function createTextDocument(uri: Uri, content: string) {
        const textDocument = typemoq.Mock.ofType<TextDocument>();
        textDocument.setup(t => t.uri).returns(() => uri);
        textDocument.setup(t => t.fileName).returns(() => uri.fsPath);
        textDocument.setup(t => t.getText()).returns(() => content);
        return textDocument.object;
    }
    function createTextEditor(doc: TextDocument) {
        const textEditor = typemoq.Mock.ofType<TextEditor>();
        textEditor.setup(e => e.document).returns(() => doc);
        return textEditor.object;
    }
    async function testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(uri: Uri, shouldOpenNotebookEditor: boolean) {
        const notebookEditor = createNotebookProvider(shouldOpenNotebookEditor);

        // Open a text document.
        const textDoc = createTextDocument(uri, 'hello');
        const textEditor = createTextEditor(textDoc);
        changeActiveTextEditorEventEmitter.fire(textEditor);

        // wait for callbacks to get executed.
        await sleep(1);

        // If we're to open the notebook, then there must be 1, else 0.
        expect(notebookEditor.editors).to.be.lengthOf(shouldOpenNotebookEditor ? 1 : 0);
        editor.verifyAll();
    }

    test('Open the notebook editor when an ipynb file is opened', async () => {
        await testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(Uri.file('some file.ipynb'), true);
    });
    async function openSameIPynbFile(openAnotherRandomFile: boolean) {
        const notebookEditor = createNotebookProvider(true);

        // Open a text document.
        const textDoc = createTextDocument(Uri.file('some file.ipynb'), 'hello');
        const textEditor = createTextEditor(textDoc);
        changeActiveTextEditorEventEmitter.fire(textEditor);

        // wait for callbacks to get executed.
        await sleep(1);

        // If we're to open the notebook, then there must be 1, else 0.
        expect(notebookEditor.editors).to.be.lengthOf(1);
        editor.verifyAll();
        // Verify we displayed the editor once.
        editor.verify(e => e.show(), typemoq.Times.exactly(1));

        if (openAnotherRandomFile) {
            // Next, open another file.
            const logFile = createTextDocument(Uri.file('some file.log'), 'hello');
            const logEditor = createTextEditor(logFile);
            changeActiveTextEditorEventEmitter.fire(logEditor);
            // wait for callbacks to get executed.
            await sleep(1);

            // Verify we didn't open another native editor.
            expect(notebookEditor.editors).to.be.lengthOf(1);
        }

        // Re-display the old ipynb file(open it again)'
        changeActiveTextEditorEventEmitter.fire(textEditor);

        // wait for callbacks to get executed.
        await sleep(1);

        // At this point the notebook should be shown (focused).
        editor.verify(e => e.show(), typemoq.Times.exactly(2));
        // Verify we didn't open another native editor (display existing file).
        expect(notebookEditor.editors).to.be.lengthOf(1);
    }
    test('Show the notebook editor when an opening the same ipynb file', async () => openSameIPynbFile(false));
    test('Show the notebook editor when an opening the same ipynb file (after opening some other random file)', async () => openSameIPynbFile(true));

    test('Do not open the notebook editor when a txt file is opened', async () => {
        await testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(Uri.file('some text file.txt'), false);
    });
    test('Open the notebook editor when an ipynb file is opened with a file scheme', async () => {
        await testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(Uri.parse('file:///some file.ipynb'), true);
    });
    test('Open the notebook editor when an ipynb file is opened with a vsls scheme (live share)', async () => {
        await testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(Uri.parse('vsls:///some file.ipynb'), true);
    });
    test('Do not open the notebook editor when an ipynb file is opened with a git scheme (comparing staged/modified files)', async () => {
        await testAutomaticallyOpeningNotebookEditorWhenOpeningFiles(Uri.parse('git://some//text file.txt'), false);
    });
    test('Multiple new notebooks have new names', async () => {
        const provider = createNotebookProvider(false);
        const n1 = await provider.createNew();
        expect(n1.file.fsPath).to.be.include('Untitled-1');
        const n2 = await provider.createNew();
        expect(n2.file.fsPath).to.be.include('Untitled-2');
    });
});
