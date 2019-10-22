// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import { ConfigurationChangeEvent, Disposable, EventEmitter, TextEditor, Uri } from 'vscode';

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
import { IConfigurationService } from '../../../client/common/types';
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
import { StatusProvider } from '../../../client/datascience/statusProvider';
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
    IStatusProvider,
    IThemeFinder
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { MockMemento } from '../../mocks/mementos';

// tslint:disable: no-any

// tslint:disable: max-func-body-length
suite('Data Science - Native Editor', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: IFileSystem;
    let doctManager: IDocumentManager;
    let dsErrorHandler: IDataScienceErrorHandler;
    let cmdManager: ICommandManager;
    let liveShare: ILiveShareApi;
    let applicationShell: IApplicationShell;
    let interpreterService: IInterpreterService;
    let webPanelProvider: IWebPanelProvider;
    const disposables: Disposable[] = [];
    let cssGenerator: ICodeCssGenerator;
    let themeFinder: IThemeFinder;
    let statusProvider: IStatusProvider;
    let executionProvider: IJupyterExecution;
    let exportProvider: INotebookExporter;
    let editorProvider: INotebookEditorProvider;
    let dataExplorerProvider: IDataViewerProvider;
    let jupyterVariables: IJupyterVariables;
    let jupyterDebugger: IJupyterDebugger;
    let importer: INotebookImporter;
    const storage: MockMemento = new MockMemento();
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
        configService = mock(ConfigurationService);
        fileSystem = mock(FileSystem);
        doctManager = mock(DocumentManager);
        dsErrorHandler = mock(DataScienceErrorHandler);
        cmdManager = mock(CommandManager);
        workspace = mock(WorkspaceService);
        liveShare = mock(LiveShareApi);
        applicationShell = mock(ApplicationShell);
        interpreterService = mock(InterpreterService);
        webPanelProvider = mock(WebPanelProvider);
        cssGenerator = mock(CodeCssGenerator);
        themeFinder = mock(ThemeFinder);
        statusProvider = mock(StatusProvider);
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
        when(doctManager.onDidChangeActiveTextEditor).thenReturn(editorChangeEvent.event);

        const sessionChangedEvent = new EventEmitter<void>();
        when(executionProvider.sessionChanged).thenReturn(sessionChangedEvent.event);

    });

    teardown(() => {
        storage.clear();
    });

    function createEditor() {
        return new NativeEditor(
            [],
            instance(liveShare),
            instance(applicationShell),
            instance(doctManager),
            instance(interpreterService),
            instance(webPanelProvider),
            disposables,
            instance(cssGenerator),
            instance(themeFinder),
            instance(statusProvider),
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
});
