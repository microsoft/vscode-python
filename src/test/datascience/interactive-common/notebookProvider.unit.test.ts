// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import * as vscode from 'vscode';
import { IFileSystem } from '../../../client/common/platform/types';
import {
    IConfigurationService,
    IDataScienceSettings,
    IDisposableRegistry,
    IExperimentsManager,
    IPythonSettings
} from '../../../client/common/types';
import { NotebookProvider } from '../../../client/datascience/interactive-common/notebookProvider';
import {
    IInteractiveWindowProvider,
    IJupyterNotebookProvider,
    INotebook,
    INotebookEditorProvider,
    IRawNotebookProvider
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
    let jupyterNotebookProvider: IJupyterNotebookProvider;
    let rawNotebookProvider: IRawNotebookProvider;
    let experimentsManager: IExperimentsManager;
    let configuration: IConfigurationService;
    let pythonSettings: IPythonSettings;
    let dataScienceSettings: IDataScienceSettings;

    setup(() => {
        fileSystem = mock<IFileSystem>();
        notebookEditorProvider = mock<INotebookEditorProvider>();
        interactiveWindowProvider = mock<IInteractiveWindowProvider>();
        disposableRegistry = mock<IDisposableRegistry>();
        jupyterNotebookProvider = mock<IJupyterNotebookProvider>();
        rawNotebookProvider = mock<IRawNotebookProvider>();
        experimentsManager = mock<IExperimentsManager>();
        configuration = mock<IConfigurationService>();

        // Set up our settings
        pythonSettings = mock<IPythonSettings>();
        dataScienceSettings = mock<IDataScienceSettings>();
        when(pythonSettings.datascience).thenReturn(instance(dataScienceSettings));
        when(dataScienceSettings.jupyterServerURI).thenReturn('local');
        when(dataScienceSettings.useDefaultConfigForJupyter).thenReturn(true);
        when(configuration.getSettings(anything())).thenReturn(instance(pythonSettings));

        // Set up experiment manager
        when(experimentsManager.inExperiment(anything())).thenReturn(false);

        notebookProvider = new NotebookProvider(
            instance(fileSystem),
            instance(notebookEditorProvider),
            instance(interactiveWindowProvider),
            instance(disposableRegistry),
            instance(rawNotebookProvider),
            instance(jupyterNotebookProvider),
            instance(configuration),
            instance(experimentsManager)
        );
    });

    test('NotebookProvider getOrCreateNotebook jupyter provider has notebook already', async () => {
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        when(jupyterNotebookProvider.getNotebook(anything())).thenResolve(notebookMock.object);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Provider should return a notebook');
    });

    test('NotebookProvider getOrCreateNotebook jupyter provider does not have notebook already', async () => {
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        when(jupyterNotebookProvider.getNotebook(anything())).thenResolve(undefined);
        when(jupyterNotebookProvider.createNotebook(anything())).thenResolve(notebookMock.object);
        when(jupyterNotebookProvider.connect(anything())).thenResolve({} as any);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Provider should return a notebook');
    });

    test('NotebookProvider getOrCreateNotebook second request should return the notebook already cached', async () => {
        const notebookMock = createTypeMoq<INotebook>('jupyter notebook');
        when(jupyterNotebookProvider.getNotebook(anything())).thenResolve(undefined);
        when(jupyterNotebookProvider.createNotebook(anything())).thenResolve(notebookMock.object);
        when(jupyterNotebookProvider.connect(anything())).thenResolve({} as any);

        const notebook = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook).to.not.equal(undefined, 'Server should return a notebook');

        const notebook2 = await notebookProvider.getOrCreateNotebook({ identity: Uri('C:\\\\foo.py') });
        expect(notebook2).to.equal(notebook);
    });
});
