// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationChangeEvent, Disposable, EventEmitter, TextEditor, Uri } from 'vscode';

import { nbformat } from '@jupyterlab/coreutils';
import * as sinon from 'sinon';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { DocumentManager } from '../../../client/common/application/documentManager';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../../client/common/application/types';
import { WebPanelProvider } from '../../../client/common/application/webPanelProvider';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { LiveShareApi } from '../../../client/common/liveshare/liveshare';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, Version } from '../../../client/common/types';
import { CodeCssGenerator } from '../../../client/datascience/codeCssGenerator';
import { DataViewerProvider } from '../../../client/datascience/data-viewing/dataViewerProvider';
import { DataScienceErrorHandler } from '../../../client/datascience/errorHandler/errorHandler';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditor } from '../../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { JupyterDebugger } from '../../../client/datascience/jupyter/jupyterDebugger';
import { JupyterExecutionFactory } from '../../../client/datascience/jupyter/jupyterExecutionFactory';
import { JupyterExporter } from '../../../client/datascience/jupyter/jupyterExporter';
import { JupyterImporter } from '../../../client/datascience/jupyter/jupyterImporter';
import { JupyterVariables } from '../../../client/datascience/jupyter/jupyterVariables';
import { ThemeFinder } from '../../../client/datascience/themeFinder';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    IThemeFinder
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { waitForCondition } from '../../common';
import { noop } from '../../core';
import { MockMemento } from '../../mocks/mementos';
import { MockStatusProvider } from '../mockStatusProvider';

// tslint:disable: no-any chai-vague-errors no-unused-expression

// tslint:disable: max-func-body-length
suite('Data Science - Native Editor', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: IFileSystem;
    let docManager: IDocumentManager;
    let dsErrorHandler: IDataScienceErrorHandler;
    let cmdManager: ICommandManager;
    let liveShare: ILiveShareApi;
    let applicationShell: IApplicationShell;
    let interpreterService: IInterpreterService;
    let webPanelProvider: IWebPanelProvider;
    const disposables: Disposable[] = [];
    let cssGenerator: ICodeCssGenerator;
    let themeFinder: IThemeFinder;
    let statusProvider: MockStatusProvider;
    let executionProvider: IJupyterExecution;
    let exportProvider: INotebookExporter;
    let editorProvider: INotebookEditorProvider;
    let dataExplorerProvider: IDataViewerProvider;
    let jupyterVariables: IJupyterVariables;
    let jupyterDebugger: IJupyterDebugger;
    let importer: INotebookImporter;
    let storage: MockMemento;
    let storageUpdateSpy: sinon.SinonSpy<[string, any], Thenable<void>>;
    const baseFile = `{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {
    "collapsed": true
   },
   "outputs": [
    {
     "data": {
      "text/plain": [
       "1"
      ]
     },
     "execution_count": 1,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "a=1\\n",
    "a"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "2"
      ]
     },
     "execution_count": 2,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "b=2\\n",
    "b"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 3,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "3"
      ]
     },
     "execution_count": 3,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "c=3\\n",
    "c"
   ]
  }
 ],
 "metadata": {
  "file_extension": ".py",
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.7.4"
  },
  "mimetype": "text/x-python",
  "name": "python",
  "npconvert_exporter": "python",
  "pygments_lexer": "ipython3",
  "version": 3
 },
 "nbformat": 4,
 "nbformat_minor": 2
}`;

    setup(() => {
        storage = new MockMemento();
        storageUpdateSpy = sinon.spy(storage, 'update');
        configService = mock(ConfigurationService);
        fileSystem = mock(FileSystem);
        docManager = mock(DocumentManager);
        dsErrorHandler = mock(DataScienceErrorHandler);
        cmdManager = mock(CommandManager);
        workspace = mock(WorkspaceService);
        liveShare = mock(LiveShareApi);
        applicationShell = mock(ApplicationShell);
        interpreterService = mock(InterpreterService);
        webPanelProvider = mock(WebPanelProvider);
        cssGenerator = mock(CodeCssGenerator);
        themeFinder = mock(ThemeFinder);
        statusProvider = new MockStatusProvider();
        executionProvider = mock(JupyterExecutionFactory);
        exportProvider = mock(JupyterExporter);
        editorProvider = mock(NativeEditorProvider);
        dataExplorerProvider = mock(DataViewerProvider);
        jupyterVariables = mock(JupyterVariables);
        jupyterDebugger = mock(JupyterDebugger);
        importer = mock(JupyterImporter);
        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();
        when(settings.onDidChange).thenReturn(settingsChangedEvent.event);
        when(configService.getSettings()).thenReturn(instance(settings));

        const configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspace.onDidChangeConfiguration).thenReturn(configChangeEvent.event);

        const interprerterChangeEvent = new EventEmitter<void>();
        when(interpreterService.onDidChangeInterpreter).thenReturn(interprerterChangeEvent.event);

        const editorChangeEvent = new EventEmitter<TextEditor | undefined>();
        when(docManager.onDidChangeActiveTextEditor).thenReturn(editorChangeEvent.event);

        const sessionChangedEvent = new EventEmitter<void>();
        when(executionProvider.sessionChanged).thenReturn(sessionChangedEvent.event);

    });

    teardown(() => {
        storage.clear();
        sinon.reset();
    });

    function createEditor() {
        return new NativeEditor(
            [],
            instance(liveShare),
            instance(applicationShell),
            instance(docManager),
            instance(interpreterService),
            instance(webPanelProvider),
            disposables,
            instance(cssGenerator),
            instance(themeFinder),
            statusProvider,
            instance(executionProvider),
            instance(fileSystem),
            instance(configService),
            instance(cmdManager),
            instance(exportProvider),
            instance(workspace),
            instance(editorProvider),
            instance(dataExplorerProvider),
            instance(jupyterVariables),
            instance(jupyterDebugger),
            instance(importer),
            instance(dsErrorHandler),
            storage
        );
    }

    test('Create new editor and add some cells', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file://foo.ipynb'));
        expect(editor.contents).to.be.equal(baseFile);
        editor.onMessage(InteractiveWindowMessages.InsertCell, { index: 0, cell: createEmptyCell('1', 1) });
        expect(editor.cells).to.be.lengthOf(4);
        expect(editor.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(editor.cells[0].id).to.be.match(/1/);
    });

    test('Move cells around', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file://foo.ipynb'));
        expect(editor.contents).to.be.equal(baseFile);
        editor.onMessage(InteractiveWindowMessages.SwapCells, { firstCellId: 'NotebookImport#0', secondCellId: 'NotebookImport#1' });
        expect(editor.cells).to.be.lengthOf(3);
        expect(editor.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(editor.cells[0].id).to.be.match(/NotebookImport#1/);
    });

    test('Edit/delete cells', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file://foo.ipynb'));
        expect(editor.contents).to.be.equal(baseFile);
        expect(editor.isDirty).to.be.equal(false, 'Editor should not be dirty');
        editor.onMessage(InteractiveWindowMessages.EditCell, {
            changes: [{
                range: {
                    startLineNumber: 2,
                    startColumn: 1,
                    endLineNumber: 2,
                    endColumn: 1
                },
                rangeOffset: 4,
                rangeLength: 0,
                text: 'a'
            }],
            id: 'NotebookImport#1'
        });
        expect(editor.cells).to.be.lengthOf(3);
        expect(editor.cells[1].id).to.be.match(/NotebookImport#1/);
        expect(editor.cells[1].data.source).to.be.equals('b=2\nab');
        expect(editor.isDirty).to.be.equal(true, 'Editor should be dirty');
        editor.onMessage(InteractiveWindowMessages.RemoveCell, { id: 'NotebookImport#0' });
        expect(editor.cells).to.be.lengthOf(2);
        expect(editor.cells[0].id).to.be.match(/NotebookImport#1/);
        editor.onMessage(InteractiveWindowMessages.DeleteAllCells, {});
        expect(editor.cells).to.be.lengthOf(0);
    });

    async function loadEditorAddCellAndWaitForMementoUpdate(file: Uri) {
        const editor = createEditor();
        await editor.load(baseFile, file);
        expect(editor.contents).to.be.equal(baseFile);
        storageUpdateSpy.resetHistory();
        editor.onMessage(InteractiveWindowMessages.InsertCell, { index: 0, cell: createEmptyCell('1', 1) });
        expect(editor.cells).to.be.lengthOf(4);

        // Wait for contents to be stored in memento.
        // Editor will save uncommitted changes into storage, wait for it to be saved.
        await waitForCondition(() => Promise.resolve(storageUpdateSpy.calledOnce), 500, 'Storage not updated');
        storageUpdateSpy.resetHistory();

        // Confirm contents were saved.
        expect(storage.get(`notebook-storage-${file.toString()}`)).not.to.be.undefined;
        expect(editor.contents).not.to.be.equal(baseFile);

        return editor;
    }
    test('Editing a notebook will save uncommitted changes into memento', async () => {
        const file = Uri.parse('file://foo.ipynb');

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        await loadEditorAddCellAndWaitForMementoUpdate(file);
    });

    test('Opening a notebook will restore uncommitted changes', async () => {
        const file = Uri.parse('file://foo.ipynb');
        when(fileSystem.stat(anything())).thenResolve({ mtime: 1 } as any);

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);

        storageUpdateSpy.resetHistory();
        // Close the editor.
        await editor.dispose();
        // Editor will save uncommitted changes into storage, wait for it to be saved.
        await waitForCondition(() => Promise.resolve(storageUpdateSpy.calledOnce), 500, 'Storage not updated');

        // Open a new one.
        const newEditor = createEditor();
        await newEditor.load(baseFile, file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        expect(newEditor.contents).not.to.be.equal(baseFile);
        const notebook = JSON.parse(newEditor.contents);
        // 4 cells (1 extra for what was added)
        expect(notebook.cells).to.be.lengthOf(4);
    });

    test('Opening a notebook will restore uncommitted changes (ignoring contents of file)', async () => {
        const file = Uri.parse('file://foo.ipynb');
        when(fileSystem.stat(anything())).thenResolve({ mtime: 1 } as any);

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);

        storageUpdateSpy.resetHistory();
        // Close the editor.
        await editor.dispose();
        // Editor will save uncommitted changes into storage, wait for it to be saved.
        await waitForCondition(() => Promise.resolve(storageUpdateSpy.calledOnce), 500, 'Storage not updated');

        // Open a new one with the same file.
        const newEditor = createEditor();
        // However, pass in some bosu content, to confirm it is NOT loaded from file.
        await newEditor.load('crap', file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        expect(newEditor.contents).not.to.be.equal(baseFile);
        const notebook = JSON.parse(newEditor.contents);
        // 4 cells (1 extra for what was added)
        expect(notebook.cells).to.be.lengthOf(4);
    });

    test('Opening a notebook will NOT restore uncommitted changes if file has been modified since', async () => {
        const file = Uri.parse('file://foo.ipynb');
        when(fileSystem.stat(anything())).thenResolve({ mtime: 1 } as any);

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);

        storageUpdateSpy.resetHistory();
        // Close the editor.
        await editor.dispose();
        // Editor will save uncommitted changes into storage, wait for it to be saved.
        await waitForCondition(() => Promise.resolve(storageUpdateSpy.calledOnce), 500, 'Storage not updated');

        // Mimic changes to file (by returning a new modified time).
        when(fileSystem.stat(anything())).thenResolve({ mtime: Date.now() } as any);

        // Open a new one.
        const newEditor = createEditor();
        await newEditor.load(baseFile, file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        expect(newEditor.contents).to.be.equal(baseFile);
        expect(newEditor.cells).to.be.lengthOf(3);
    });

    test('Python version info will be updated in notebook when a cell has been executed', async () => {
        const file = Uri.parse('file://foo.ipynb');

        const editor = createEditor();
        await editor.load(baseFile, file);
        expect(editor.contents).to.be.equal(baseFile);
        // At the begining version info is NOT in the file (at least not the same as what we are using to run cells).
        let contents = JSON.parse(editor.contents) as nbformat.INotebookContent;
        expect(contents.metadata!.language_info!.version).to.not.equal('10.11.12');

        // When a cell is executed, then ensure we store the python version info in the notebook data.
        const version: Version = { build: [], major: 10, minor: 11, patch: 12, prerelease: [], raw: '10.11.12' };
        when(executionProvider.getUsableJupyterPython()).thenResolve(({ version } as any));

        try {
            editor.onMessage(InteractiveWindowMessages.SubmitNewCell, { code: 'hello', id: '1' });
        } catch {
            // Ignore errors related to running cells, assume that works.
            noop();
        }

        // Wait for the version info to be retrieved (done in the background).
        await waitForCondition(async () => {
            try {
                verify(executionProvider.getUsableJupyterPython()).atLeast(1);
                return true;
            } catch {
                return false;
            }
        }, 5_000, 'Timeout');

        // Verify the version info is in the notbook.
        contents = JSON.parse(editor.contents) as nbformat.INotebookContent;
        expect(contents.metadata!.language_info!.version).to.equal('10.11.12');
    });

    test('Export to Python script file from notebook.', async () => {
        // Temp file location needed for export
        const tempFile = {
            dispose: () => {
                return undefined;
            },
            filePath: '/foo/bar.ipynb'
        };
        when(fileSystem.createTemporaryFile('.ipynb')).thenResolve(tempFile);

        // Set up our importer to return file contents, check that we have the correct temp file location and
        // original file location
        const file = Uri.parse('file:///foo.ipynb');
        when(importer.importFromFile('/foo/bar.ipynb', file.fsPath)).thenResolve('# File Contents');

        // Just return empty objects here, we don't care about open or show function, just that they were called
        when(docManager.openTextDocument({ language: 'python', content: '# File Contents' })).thenResolve({} as any);
        when(docManager.showTextDocument(anything(), anything())).thenResolve({} as any);

        const editor = createEditor();
        await editor.load(baseFile, file);
        expect(editor.contents).to.be.equal(baseFile);

        // Make our call to actually export
        editor.onMessage(InteractiveWindowMessages.Export, editor.cells);

        await waitForCondition(async () => {
            try {
                // Wait until showTextDocument has been called, that's the signal that export is done
                verify(docManager.showTextDocument(anything(), anything())).atLeast(1);
                return true;
            } catch {
                return false;
            }
        }, 1_000, 'Timeout');

        // Verify that we also opened our text document not exact match as verify doesn't seem to match that
        verify(docManager.openTextDocument(anything())).once();
    });
});
