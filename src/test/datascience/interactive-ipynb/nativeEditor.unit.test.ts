// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { fail } from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import * as typemoq from 'typemoq';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    Disposable,
    EventEmitter,
    TextEditor,
    Uri,
    WorkspaceConfiguration
} from 'vscode';

import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { DocumentManager } from '../../../client/common/application/documentManager';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelMessageListener,
    IWebPanelProvider,
    IWorkspaceService
} from '../../../client/common/application/types';
import { WebPanel } from '../../../client/common/application/webPanels/webPanel';
import { WebPanelProvider } from '../../../client/common/application/webPanels/webPanelProvider';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CryptoUtils } from '../../../client/common/crypto';
import { ExperimentsManager } from '../../../client/common/experiments';
import { IFileSystem } from '../../../client/common/platform/types';
import {
    IConfigurationService,
    ICryptoUtils,
    IExperimentsManager,
    IExtensionContext
} from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
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
import { LiveShareApi } from '../../../client/datascience/liveshare/liveshare';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
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
    INotebookServerOptions,
    IThemeFinder
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { waitForCondition } from '../../common';
import { MockMemento } from '../../mocks/mementos';
import { MockStatusProvider } from '../mockStatusProvider';

// tslint:disable: no-any chai-vague-errors no-unused-expression
class MockWorkspaceConfiguration implements WorkspaceConfiguration {
    private map: Map<string, any> = new Map<string, any>();

    // tslint:disable: no-any
    public get(key: string): any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any): any;
    public get(section: string, defaultValue?: any): any {
        if (this.map.has(section)) {
            return this.map.get(section);
        }
        return arguments.length > 1 ? defaultValue : (undefined as any);
    }
    public has(_section: string): boolean {
        return false;
    }
    public inspect<T>(
        _section: string
    ):
        | {
              key: string;
              defaultValue?: T | undefined;
              globalValue?: T | undefined;
              workspaceValue?: T | undefined;
              workspaceFolderValue?: T | undefined;
          }
        | undefined {
        return;
    }
    public update(
        section: string,
        value: any,
        _configurationTarget?: boolean | ConfigurationTarget | undefined
    ): Promise<void> {
        this.map.set(section, value);
        return Promise.resolve();
    }
}

// tslint:disable: max-func-body-length
suite('Data Science - Native Editor', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: typemoq.IMock<IFileSystem>;
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
    let localStorage: MockMemento;
    let context: typemoq.IMock<IExtensionContext>;
    let crypto: ICryptoUtils;
    let lastWriteFileValue: any;
    let wroteToFileEvent: EventEmitter<string> = new EventEmitter<string>();
    let filesConfig: MockWorkspaceConfiguration | undefined;
    let testIndex = 0;
    let reporter: ProgressReporter;
    let experimentsManager: IExperimentsManager;
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
        context = typemoq.Mock.ofType<IExtensionContext>();
        crypto = mock(CryptoUtils);
        storage = new MockMemento();
        localStorage = new MockMemento();
        configService = mock(ConfigurationService);
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
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
        reporter = mock(ProgressReporter);
        experimentsManager = mock(ExperimentsManager);
        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();

        context
            .setup(c => c.globalStoragePath)
            .returns(() => path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience', 'WorkspaceDir'));

        when(experimentsManager.inExperiment(anything())).thenReturn(false);
        when(settings.onDidChange).thenReturn(settingsChangedEvent.event);
        when(configService.getSettings(anything())).thenReturn(instance(settings));

        const configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspace.onDidChangeConfiguration).thenReturn(configChangeEvent.event);
        filesConfig = new MockWorkspaceConfiguration();
        when(workspace.getConfiguration('files', anything())).thenReturn(filesConfig);

        const interprerterChangeEvent = new EventEmitter<void>();
        when(interpreterService.onDidChangeInterpreter).thenReturn(interprerterChangeEvent.event);

        const editorChangeEvent = new EventEmitter<TextEditor | undefined>();
        when(docManager.onDidChangeActiveTextEditor).thenReturn(editorChangeEvent.event);

        const sessionChangedEvent = new EventEmitter<void>();
        when(executionProvider.sessionChanged).thenReturn(sessionChangedEvent.event);

        const serverStartedEvent = new EventEmitter<INotebookServerOptions>();
        when(executionProvider.serverStarted).thenReturn(serverStartedEvent.event);

        testIndex += 1;
        when(crypto.createHash(anything(), 'string')).thenReturn(`${testIndex}`);

        let listener: IWebPanelMessageListener;
        const webPanel = mock(WebPanel);
        class WebPanelCreateMatcher extends Matcher {
            public match(value: any) {
                listener = value.listener;
                listener.onMessage(InteractiveWindowMessages.Started, undefined);
                return true;
            }
            public toString() {
                return '';
            }
        }
        const matcher = (): any => {
            return new WebPanelCreateMatcher();
        };
        when(webPanelProvider.create(matcher())).thenResolve(instance(webPanel));
        lastWriteFileValue = undefined;
        wroteToFileEvent = new EventEmitter<string>();
        fileSystem
            .setup(f => f.writeFile(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((a1, a2) => {
                if (a1.includes(`${testIndex}.ipynb`)) {
                    lastWriteFileValue = a2;
                    wroteToFileEvent.fire(a2);
                }
                return Promise.resolve();
            });
        fileSystem
            .setup(f => f.readFile(typemoq.It.isAny()))
            .returns(_a1 => {
                return Promise.resolve(lastWriteFileValue);
            });
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
            fileSystem.object, // Use typemoq so can save values in returns
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
            storage,
            localStorage,
            instance(crypto),
            context.object,
            instance(reporter),
            instance(experimentsManager)
        );
    }

    test('Create new editor and add some cells', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file:///foo.ipynb'));
        expect(await editor.getContents()).to.be.equal(baseFile);
        editor.onMessage(InteractiveWindowMessages.InsertCell, { index: 0, cell: createEmptyCell('1', 1) });
        expect(editor.cells).to.be.lengthOf(4);
        expect(editor.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(editor.cells[0].id).to.be.match(/1/);
    });

    test('Move cells around', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file:///foo.ipynb'));
        expect(await editor.getContents()).to.be.equal(baseFile);
        editor.onMessage(InteractiveWindowMessages.SwapCells, {
            firstCellId: 'NotebookImport#0',
            secondCellId: 'NotebookImport#1'
        });
        expect(editor.cells).to.be.lengthOf(3);
        expect(editor.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(editor.cells[0].id).to.be.match(/NotebookImport#1/);
    });

    test('Edit/delete cells', async () => {
        const editor = createEditor();
        await editor.load(baseFile, Uri.parse('file:///foo.ipynb'));
        expect(await editor.getContents()).to.be.equal(baseFile);
        expect(editor.isDirty).to.be.equal(false, 'Editor should not be dirty');
        editor.onMessage(InteractiveWindowMessages.EditCell, {
            changes: [
                {
                    range: {
                        startLineNumber: 2,
                        startColumn: 1,
                        endLineNumber: 2,
                        endColumn: 1
                    },
                    rangeOffset: 4,
                    rangeLength: 0,
                    text: 'a'
                }
            ],
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
        expect(await editor.getContents()).to.be.equal(baseFile);
        const savedPromise = createDeferred<boolean>();
        const disposable = wroteToFileEvent.event((c: string) => {
            // Double check our contents are there
            const fileContents = JSON.parse(c);
            if (fileContents.contents) {
                const contents = JSON.parse(fileContents.contents);
                if (contents.cells && contents.cells.length === 4) {
                    savedPromise.resolve(true);
                }
            }
        });
        editor.onMessage(InteractiveWindowMessages.InsertCell, { index: 0, cell: createEmptyCell('1', 1) });
        expect(editor.cells).to.be.lengthOf(4);

        // Wait for contents to be stored in memento.
        // Editor will save uncommitted changes into storage, wait for it to be saved.
        try {
            await waitForCondition(() => savedPromise.promise, 500, 'Storage not updated');
        } finally {
            disposable.dispose();
        }

        // Confirm contents were saved.
        expect(await editor.getContents()).not.to.be.equal(baseFile);

        return editor;
    }
    test('Editing a notebook will save uncommitted changes into memento', async () => {
        await filesConfig?.update('autoSave', 'off');
        const file = Uri.parse('file:///foo.ipynb');

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);
        await editor.dispose();
    });

    test('Editing a notebook will not save uncommitted changes into storage when autoSave is on', async () => {
        await filesConfig?.update('autoSave', 'on');
        const file = Uri.parse('file:///foo.ipynb');

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        try {
            await loadEditorAddCellAndWaitForMementoUpdate(file);
            fail('Should have timed out');
        } catch (e) {
            expect(e.toString()).to.include('not updated');
        }
    });

    test('Opening a notebook will restore uncommitted changes', async () => {
        await filesConfig?.update('autoSave', 'off');
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));
        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);

        // Close the editor.
        await editor.dispose();

        // Open a new one.
        const newEditor = createEditor();
        await newEditor.load(baseFile, file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        const contents = await newEditor.getContents();
        expect(contents).not.to.be.equal(baseFile);
        const notebook = JSON.parse(contents);
        // 4 cells (1 extra for what was added)
        expect(notebook.cells).to.be.lengthOf(4);
    });

    test('Opening a notebook will restore uncommitted changes (ignoring contents of file)', async () => {
        await filesConfig?.update('autoSave', 'off');
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);

        // Close the editor.
        await editor.dispose();

        // Open a new one with the same file.
        const newEditor = createEditor();

        // However, pass in some bosu content, to confirm it is NOT loaded from file.
        await newEditor.load('crap', file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        expect(await newEditor.getContents()).not.to.be.equal(baseFile);
        const notebook = JSON.parse(await newEditor.getContents());
        // 4 cells (1 extra for what was added)
        expect(notebook.cells).to.be.lengthOf(4);
    });

    test('Opening a notebook will NOT restore uncommitted changes if file has been modified since', async () => {
        await filesConfig?.update('autoSave', 'off');
        const file = Uri.parse('file:///foo.ipynb');
        const editor = await loadEditorAddCellAndWaitForMementoUpdate(file);
        // Close the editor.
        await editor.dispose();

        // Make file appear modified.
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: Date.now() } as any));

        // Open a new one.
        const newEditor = createEditor();
        await newEditor.load(baseFile, file);

        // Verify contents are different.
        // Meaning it was not loaded from file, but loaded from our storage.
        expect(await newEditor.getContents()).to.be.equal(baseFile);
        expect(newEditor.cells).to.be.lengthOf(3);
    });

    test('Opening file with local storage but no global will still open with old contents', async () => {
        await filesConfig?.update('autoSave', 'off');
        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localStorage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the local storage
        localStorage.update(`notebook-storage-${file.toString()}`, baseFile);
        const editor = createEditor();
        await editor.load('', file);

        // It should load with that value
        expect(await editor.getContents()).to.be.equal(baseFile);
        expect(editor.cells).to.be.lengthOf(3);
    });

    test('Opening file with global storage but no global file will still open with old contents', async () => {
        await filesConfig?.update('autoSave', 'off');
        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localStorage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the global storage
        storage.update(`notebook-storage-${file.toString()}`, { contents: baseFile, lastModifiedTimeMs: Date.now() });
        const editor = createEditor();
        await editor.load('', file);

        // It should load with that value
        expect(await editor.getContents()).to.be.equal(baseFile);
        expect(editor.cells).to.be.lengthOf(3);
    });

    test('Opening file with global storage will clear all global storage', async () => {
        await filesConfig?.update('autoSave', 'off');

        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        // Initially nothing in memento
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localStorage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the global storage
        storage.update(`notebook-storage-${file.toString()}`, { contents: baseFile, lastModifiedTimeMs: Date.now() });

        // Put another file into the global storage
        storage.update(`notebook-storage-file::///bar.ipynb`, { contents: baseFile, lastModifiedTimeMs: Date.now() });

        const editor = createEditor();
        await editor.load('', file);

        // It should load with that value
        expect(await editor.getContents()).to.be.equal(baseFile);
        expect(editor.cells).to.be.lengthOf(3);

        // And global storage should be empty
        expect(storage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(storage.get(`notebook-storage-file::///bar.ipynb`)).to.be.undefined;
        expect(localStorage.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
    });

    test('Export to Python script file from notebook.', async () => {
        // Temp file location needed for export
        const tempFile = {
            dispose: () => {
                return undefined;
            },
            filePath: '/foo/bar.ipynb'
        };
        fileSystem.setup(f => f.createTemporaryFile('.ipynb')).returns(() => Promise.resolve(tempFile));

        // Set up our importer to return file contents, check that we have the correct temp file location and
        // original file location
        const file = Uri.parse('file:///foo.ipynb');
        when(importer.importFromFile('/foo/bar.ipynb', file.fsPath)).thenResolve('# File Contents');

        // Just return empty objects here, we don't care about open or show function, just that they were called
        when(docManager.openTextDocument({ language: 'python', content: '# File Contents' })).thenResolve({} as any);
        when(docManager.showTextDocument(anything(), anything())).thenResolve({} as any);

        const editor = createEditor();
        await editor.load(baseFile, file);
        expect(await editor.getContents()).to.be.equal(baseFile);

        // Make our call to actually export
        editor.onMessage(InteractiveWindowMessages.Export, editor.cells);

        await waitForCondition(
            async () => {
                try {
                    // Wait until showTextDocument has been called, that's the signal that export is done
                    verify(docManager.showTextDocument(anything(), anything())).atLeast(1);
                    return true;
                } catch {
                    return false;
                }
            },
            1_000,
            'Timeout'
        );

        // Verify that we also opened our text document not exact match as verify doesn't seem to match that
        verify(docManager.openTextDocument(anything())).once();
    });
});
