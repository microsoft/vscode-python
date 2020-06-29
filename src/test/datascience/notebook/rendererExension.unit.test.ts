// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Extension, ExtensionKind, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { VSCodeNotebook } from '../../../client/common/application/notebook';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable, IExtensions } from '../../../client/common/types';
import { JupyterNotebookView, RendererExtensionId } from '../../../client/datascience/notebook/constants';
import { RendererExtension } from '../../../client/datascience/notebook/rendererExtension';
import { RendererExtensionDownloader } from '../../../client/datascience/notebook/rendererExtensionDownloader';

suite('Data Science - NativeNotebook Renderer Extension', () => {
    let rendererExtension: IExtensionSingleActivationService;
    let downloader: RendererExtensionDownloader;
    let vscNotebook: IVSCodeNotebook;
    let extensions: IExtensions;
    let onDidOpenNotebookDocument: EventEmitter<NotebookDocument>;
    const disposables: IDisposable[] = [];
    const jupyterNotebook: NotebookDocument = {
        cells: [],
        uri: Uri.file('one.ipynb'),
        fileName: '',
        isDirty: false,
        languages: [],
        metadata: {},
        viewType: JupyterNotebookView
    };
    const nonJupyterNotebook: NotebookDocument = {
        cells: [],
        uri: Uri.file('one.xyz'),
        fileName: '',
        isDirty: false,
        languages: [],
        metadata: {},
        viewType: 'somethingElse'
    };
    const extension: Extension<{}> = {
        activate: () => Promise.resolve({}),
        exports: {},
        extensionKind: ExtensionKind.UI,
        extensionPath: '',
        extensionUri: Uri.file(__filename),
        id: RendererExtensionId,
        isActive: true,
        packageJSON: {}
    };
    setup(() => {
        downloader = mock(RendererExtensionDownloader);
        vscNotebook = mock(VSCodeNotebook);
        extensions = mock<IExtensions>();
        rendererExtension = new RendererExtension(
            instance(vscNotebook),
            instance(downloader),
            instance(extensions),
            disposables
        );
        onDidOpenNotebookDocument = new EventEmitter<NotebookDocument>();
        when(vscNotebook.notebookDocuments).thenReturn([]);
        when(vscNotebook.onDidOpenNotebookDocument).thenReturn(onDidOpenNotebookDocument.event);
        when(downloader.downloadAndInstall()).thenResolve();
        when(extensions.getExtension(anything())).thenReturn();
    });
    suite('Extension has not been installed', () => {
        setup(() => when(extensions.getExtension(anything())).thenReturn());
        test('Should not download extension', async () => {
            await rendererExtension.activate();

            verify(downloader.downloadAndInstall()).never();
        });
        test('A jupyter notebook is already open', async () => {
            when(vscNotebook.notebookDocuments).thenReturn([jupyterNotebook]);
            await rendererExtension.activate();

            verify(downloader.downloadAndInstall()).once();
        });
        test('A jupyter notebook is opened', async () => {
            await rendererExtension.activate();
            onDidOpenNotebookDocument.fire(jupyterNotebook);

            verify(downloader.downloadAndInstall()).once();
        });
        test('A non-jupyter notebook is already open', async () => {
            when(vscNotebook.notebookDocuments).thenReturn([nonJupyterNotebook]);
            await rendererExtension.activate();

            verify(downloader.downloadAndInstall()).never();
        });
        test('A non-jupyter notebook is opened', async () => {
            await rendererExtension.activate();
            onDidOpenNotebookDocument.fire(nonJupyterNotebook);

            verify(downloader.downloadAndInstall()).never();
        });
    });
    suite('Extension has already been installed', () => {
        setup(() => when(extensions.getExtension(RendererExtensionId)).thenReturn(extension));
        test('A jupyter notebook is already open', async () => {
            when(vscNotebook.notebookDocuments).thenReturn([jupyterNotebook]);
            await rendererExtension.activate();

            verify(downloader.downloadAndInstall()).never();
        });
        test('A jupyter notebook is opened', async () => {
            await rendererExtension.activate();
            onDidOpenNotebookDocument.fire(jupyterNotebook);

            verify(downloader.downloadAndInstall()).never();
        });
        test('A non-jupyter notebook is already open', async () => {
            when(vscNotebook.notebookDocuments).thenReturn([nonJupyterNotebook]);
            await rendererExtension.activate();

            verify(downloader.downloadAndInstall()).never();
        });
        test('A non-jupyter notebook is opened', async () => {
            await rendererExtension.activate();
            onDidOpenNotebookDocument.fire(nonJupyterNotebook);

            verify(downloader.downloadAndInstall()).never();
        });
    });
});
