// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import * as vscode from 'vscode';
import { IFileSystem } from '../../../client/common/platform/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { NotebookProvider } from '../../../client/datascience/interactive-common/notebookProvider';
import {
    IInteractiveWindowProvider,
    INotebook,
    INotebookEditorProvider,
    INotebookServer,
    INotebookServerProvider
} from '../../../client/datascience/types';

function Uri(filename: string): vscode.Uri {
    return vscode.Uri.file(filename);
}

// tslint:disable:no-any
function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
    // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
    // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
    const result = typemoq.Mock.ofType<T>();
    (result as any).tag = tag;
    result.setup((x: any) => x.then).returns(() => undefined);
    return result;
}

// tslint:disable: max-func-body-length
suite('Data Science - NotebookProvider', () => {
    let notebookProvider: NotebookProvider;
    let fileSystem: IFileSystem;
    let notebookEditorProvider: INotebookEditorProvider;
    let interactiveWindowProvider: IInteractiveWindowProvider;
    let disposableRegistry: IDisposableRegistry;
    let notebookServerProvider: INotebookServerProvider;

    setup(() => {
        fileSystem = mock<IFileSystem>();
        notebookEditorProvider = mock<INotebookEditorProvider>();
        interactiveWindowProvider = mock<IInteractiveWindowProvider>();
        disposableRegistry = mock<IDisposableRegistry>();
        notebookServerProvider = mock<INotebookServerProvider>();
        notebookProvider = new NotebookProvider(
            instance(fileSystem),
            instance(notebookEditorProvider),
            instance(interactiveWindowProvider),
            instance(disposableRegistry),
            instance(notebookServerProvider)
        );
    });

    test('NotebookProvider getOrCreateNotebook no server', async () => {
        when(notebookServerProvider.getOrCreateServer(anything())).thenResolve(undefined);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.equal(undefined, 'No server should return no notebook');
    });

    test('NotebookProvider getOrCreateNotebook server has notebook already', async () => {
        const notebookServer = createTypeMoq<INotebookServer>('jupyter server');
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        notebookServer
            .setup(s => s.getNotebook(typemoq.It.isAny()))
            .returns(() => Promise.resolve(notebookMock.object));
        when(notebookServerProvider.getOrCreateServer(anything())).thenResolve(notebookServer.object);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Server should return a notebook');
    });

    test('NotebookProvider getOrCreateNotebook server does not have notebook already', async () => {
        const notebookServer = createTypeMoq<INotebookServer>('jupyter server');
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        // Get notebook undefined, but create notebook set
        notebookServer.setup(s => s.getNotebook(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));
        notebookServer
            .setup(s => s.createNotebook(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(notebookMock.object));
        when(notebookServerProvider.getOrCreateServer(anything())).thenResolve(notebookServer.object);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Server should return a notebook');
    });

    test('NotebookProvider getOrCreateNotebook getOnly server does not have notebook already', async () => {
        const notebookServer = createTypeMoq<INotebookServer>('jupyter server');
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        // Get notebook undefined, but create notebook set
        notebookServer.setup(s => s.getNotebook(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));
        notebookServer
            .setup(s => s.createNotebook(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(notebookMock.object));
        when(notebookServerProvider.getOrCreateServer(anything())).thenResolve(notebookServer.object);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Server should return a notebook');
    });

    test('NotebookProvider getOrCreateNotebook second request should return the notebook already cached', async () => {
        const notebookServer = createTypeMoq<INotebookServer>('jupyter server');
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        // Get notebook undefined, but create notebook set
        notebookServer.setup(s => s.getNotebook(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));
        notebookServer
            .setup(s => s.createNotebook(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(notebookMock.object));
        when(notebookServerProvider.getOrCreateServer(anything())).thenResolve(notebookServer.object);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Server should return a notebook');

        const notebook2 = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook2).to.equal(notebook);

        // Only one create call
        notebookServer.verify(
            s => s.createNotebook(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()),
            typemoq.Times.once()
        );
    });
});
