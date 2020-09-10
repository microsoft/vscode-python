// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, EventEmitter, FileType, TextEditor, Uri } from 'vscode';

import { CancellationToken } from 'vscode-jsonrpc';
import { DocumentManager } from '../../../client/common/application/documentManager';
import {
    IDocumentManager,
    IWebviewPanelMessageListener,
    IWebviewPanelProvider,
    IWorkspaceService
} from '../../../client/common/application/types';
import { WebviewPanel } from '../../../client/common/application/webviewPanels/webviewPanel';
import { WebviewPanelProvider } from '../../../client/common/application/webviewPanels/webviewPanelProvider';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CryptoUtils } from '../../../client/common/crypto';
import { IConfigurationService, ICryptoUtils, IDisposable, IExtensionContext } from '../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import {
    IEditorContentChange,
    InteractiveWindowMessages
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { TrustService } from '../../../client/datascience/interactive-ipynb/trustService';
import { JupyterExecutionFactory } from '../../../client/datascience/jupyter/jupyterExecutionFactory';
import { NotebookModelFactory } from '../../../client/datascience/notebookStorage/factory';
import { NativeEditorStorage } from '../../../client/datascience/notebookStorage/nativeEditorStorage';
import { NotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import {
    ICell,
    IDataScienceFileSystem,
    IJupyterExecution,
    INotebookModel,
    INotebookServerOptions,
    ITrustService
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { concatMultilineString } from '../../../datascience-ui/common';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { MockMemento } from '../../mocks/mementos';
import { MockWorkspaceConfiguration } from '../mockWorkspaceConfig';

// tslint:disable: no-any chai-vague-errors no-unused-expression

// tslint:disable: max-func-body-length
suite('DataScience - Native Editor Storage', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: typemoq.IMock<IDataScienceFileSystem>;
    let docManager: IDocumentManager;
    let interpreterService: IInterpreterService;
    let webPanelProvider: IWebviewPanelProvider;
    let executionProvider: IJupyterExecution;
    let globalMemento: MockMemento;
    let localMemento: MockMemento;
    let trustService: ITrustService;
    let context: typemoq.IMock<IExtensionContext>;
    let crypto: ICryptoUtils;
    let lastWriteFileValue: any;
    let wroteToFileEvent: EventEmitter<string> = new EventEmitter<string>();
    let filesConfig: MockWorkspaceConfiguration | undefined;
    let testIndex = 0;
    let model: INotebookModel;
    let storage: NotebookStorageProvider;
    const disposables: IDisposable[] = [];
    const baseUri = Uri.parse('file:///foo.ipynb');
    const untiledUri = Uri.parse('untitled:///untitled-1.ipynb');
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

    const differentFile = `{
    "cells": [
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
        globalMemento = new MockMemento();
        localMemento = new MockMemento();
        configService = mock(ConfigurationService);
        fileSystem = typemoq.Mock.ofType<IDataScienceFileSystem>();
        docManager = mock(DocumentManager);
        workspace = mock(WorkspaceService);
        interpreterService = mock(InterpreterService);
        webPanelProvider = mock(WebviewPanelProvider);
        executionProvider = mock(JupyterExecutionFactory);
        trustService = mock(TrustService);
        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();

        context
            .setup((c) => c.globalStoragePath)
            .returns(() => path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience', 'WorkspaceDir'));

        when(settings.onDidChange).thenReturn(settingsChangedEvent.event);
        when(configService.getSettings()).thenReturn(instance(settings));

        const configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspace.onDidChangeConfiguration).thenReturn(configChangeEvent.event);
        filesConfig = new MockWorkspaceConfiguration();
        when(workspace.getConfiguration('files', anything())).thenReturn(filesConfig);

        const interprerterChangeEvent = new EventEmitter<void>();
        when(interpreterService.onDidChangeInterpreter).thenReturn(interprerterChangeEvent.event);

        const editorChangeEvent = new EventEmitter<TextEditor | undefined>();
        when(docManager.onDidChangeActiveTextEditor).thenReturn(editorChangeEvent.event);

        const serverStartedEvent = new EventEmitter<INotebookServerOptions>();
        when(executionProvider.serverStarted).thenReturn(serverStartedEvent.event);

        when(trustService.isNotebookTrusted(anything(), anything())).thenReturn(Promise.resolve(true));
        when(trustService.trustNotebook(anything(), anything())).thenCall(() => {
            return Promise.resolve();
        });

        testIndex += 1;
        when(crypto.createHash(anything(), 'string')).thenReturn(`${testIndex}`);

        let listener: IWebviewPanelMessageListener;
        const webPanel = mock(WebviewPanel);
        const startTime = Date.now();
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
        lastWriteFileValue = baseFile;
        wroteToFileEvent = new EventEmitter<string>();
        fileSystem
            .setup((f) => f.writeFile(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((a1, a2) => {
                if (a1.fsPath && a1.fsPath.includes(`${testIndex}.ipynb`)) {
                    lastWriteFileValue = a2;
                    wroteToFileEvent.fire(a2);
                }
                return Promise.resolve();
            });
        fileSystem
            .setup((f) => f.writeLocalFile(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((a1, a2) => {
                if (a1 && a1.includes(`${testIndex}.ipynb`)) {
                    lastWriteFileValue = a2;
                    wroteToFileEvent.fire(a2);
                }
                return Promise.resolve();
            });
        fileSystem
            .setup((f) => f.readFile(typemoq.It.isAny()))
            .returns((_a1) => {
                return Promise.resolve(lastWriteFileValue);
            });
        fileSystem
            .setup((f) => f.readLocalFile(typemoq.It.isAny()))
            .returns((_a1) => {
                return Promise.resolve(lastWriteFileValue);
            });
        fileSystem
            .setup((f) => f.stat(typemoq.It.isAny()))
            .returns((_a1) => {
                return Promise.resolve({ mtime: startTime, type: FileType.File, ctime: startTime, size: 100 });
            });
        storage = createStorage();
    });

    function createStorage() {
        const notebookStorage = new NativeEditorStorage(
            instance(executionProvider),
            fileSystem.object, // Use typemoq so can save values in returns
            instance(crypto),
            context.object,
            globalMemento,
            localMemento,
            instance(trustService),
            new NotebookModelFactory(false)
        );

        return new NotebookStorageProvider(notebookStorage, [], instance(workspace));
    }

    teardown(() => {
        globalMemento.clear();
        sinon.reset();
        disposables.forEach((d) => d.dispose());
    });

    function insertCell(index: number, code: string) {
        const cell = createEmptyCell(undefined, 1);
        cell.data.source = code;
        return model.update({
            source: 'user',
            kind: 'insert',
            oldDirty: model.isDirty,
            newDirty: true,
            cell,
            index
        });
    }

    function swapCells(first: string, second: string) {
        return model.update({
            source: 'user',
            kind: 'swap',
            oldDirty: model.isDirty,
            newDirty: true,
            firstCellId: first,
            secondCellId: second
        });
    }

    function editCell(changes: IEditorContentChange[], cell: ICell, _newCode: string) {
        return model.update({
            source: 'user',
            kind: 'edit',
            oldDirty: model.isDirty,
            newDirty: true,
            forward: changes,
            reverse: changes,
            id: cell.id
        });
    }

    function removeCell(index: number, cell: ICell) {
        return model.update({
            source: 'user',
            kind: 'remove',
            oldDirty: model.isDirty,
            newDirty: true,
            index,
            cell
        });
    }

    function deleteAllCells() {
        return model.update({
            source: 'user',
            kind: 'remove_all',
            oldDirty: model.isDirty,
            newDirty: true,
            oldCells: [...model.cells],
            newCellId: '1'
        });
    }

    test('Create new editor and add some cells', async () => {
        model = await storage.getOrCreateModel(baseUri);
        insertCell(0, '1');
        const cells = model.cells;
        expect(cells).to.be.lengthOf(4);
        expect(model.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(cells[0].id).to.be.match(/1/);
    });

    test('Move cells around', async () => {
        model = await storage.getOrCreateModel(baseUri);
        swapCells('NotebookImport#0', 'NotebookImport#1');
        const cells = model.cells;
        expect(cells).to.be.lengthOf(3);
        expect(model.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(cells[0].id).to.be.match(/NotebookImport#1/);
    });

    test('Edit/delete cells', async () => {
        model = await storage.getOrCreateModel(baseUri);
        expect(model.isDirty).to.be.equal(false, 'Editor should not be dirty');
        editCell(
            [
                {
                    range: {
                        startLineNumber: 2,
                        startColumn: 1,
                        endLineNumber: 2,
                        endColumn: 1
                    },
                    rangeOffset: 4,
                    rangeLength: 0,
                    text: 'a',
                    position: {
                        lineNumber: 1,
                        column: 1
                    }
                }
            ],
            model.cells[1],
            'a'
        );
        let cells = model.cells;
        expect(cells).to.be.lengthOf(3);
        expect(cells[1].id).to.be.match(/NotebookImport#1/);
        expect(concatMultilineString(cells[1].data.source)).to.be.equals('b=2\nab');
        expect(model.isDirty).to.be.equal(true, 'Editor should be dirty');
        removeCell(0, cells[0]);
        cells = model.cells;
        expect(cells).to.be.lengthOf(2);
        expect(cells[0].id).to.be.match(/NotebookImport#1/);
        deleteAllCells();
        cells = model.cells;
        expect(cells).to.be.lengthOf(1);
    });

    test('Editing a file and closing will keep contents', async () => {
        await filesConfig?.update('autoSave', 'off');

        model = await storage.getOrCreateModel(baseUri);
        expect(model.isDirty).to.be.equal(false, 'Editor should not be dirty');
        editCell(
            [
                {
                    range: {
                        startLineNumber: 2,
                        startColumn: 1,
                        endLineNumber: 2,
                        endColumn: 1
                    },
                    rangeOffset: 4,
                    rangeLength: 0,
                    text: 'a',
                    position: {
                        lineNumber: 1,
                        column: 1
                    }
                }
            ],
            model.cells[1],
            'a'
        );

        // Force a backup
        await storage.backup(model, CancellationToken.None);

        // Recreate
        storage = createStorage();
        model = await storage.getOrCreateModel(baseUri);

        const cells = model.cells;
        expect(cells).to.be.lengthOf(3);
        expect(cells[1].id).to.be.match(/NotebookImport#1/);
        expect(concatMultilineString(cells[1].data.source)).to.be.equals('b=2\nab');
        expect(model.isDirty).to.be.equal(true, 'Editor should be dirty');
    });

    test('Editing a new file and closing will keep contents', async () => {
        model = await storage.getOrCreateModel(untiledUri, undefined, true);
        expect(model.isDirty).to.be.equal(false, 'Editor should not be dirty');
        insertCell(0, 'a=1');

        // Wait for backup
        await storage.backup(model, CancellationToken.None);

        // Recreate
        storage = createStorage();
        model = await storage.getOrCreateModel(untiledUri);

        const cells = model.cells;
        expect(cells).to.be.lengthOf(2);
        expect(concatMultilineString(cells[0].data.source)).to.be.equals('a=1');
        expect(model.isDirty).to.be.equal(true, 'Editor should be dirty');
    });

    test('Opening file with local storage but no global will still open with old contents', async () => {
        await filesConfig?.update('autoSave', 'off');
        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');

        // Initially nothing in memento
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the local storage
        await localMemento.update(`notebook-storage-${file.toString()}`, differentFile);
        model = await storage.getOrCreateModel(file);

        // It should load with that value
        const cells = model.cells;
        expect(cells).to.be.lengthOf(2);
    });

    test('Opening file with global storage but no global file will still open with old contents', async () => {
        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup((f) => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        // Initially nothing in memento
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the global storage
        await globalMemento.update(`notebook-storage-${file.toString()}`, {
            contents: differentFile,
            lastModifiedTimeMs: Date.now()
        });
        model = await storage.getOrCreateModel(file);

        // It should load with that value
        const cells = model.cells;
        expect(cells).to.be.lengthOf(2);
    });

    test('Opening file with global storage will clear all global storage', async () => {
        await filesConfig?.update('autoSave', 'off');

        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup((f) => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        // Initially nothing in memento
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the global storage
        await globalMemento.update(`notebook-storage-${file.toString()}`, {
            contents: differentFile,
            lastModifiedTimeMs: Date.now()
        });

        // Put another file into the global storage
        await globalMemento.update(`notebook-storage-file::///bar.ipynb`, {
            contents: differentFile,
            lastModifiedTimeMs: Date.now()
        });

        model = await storage.getOrCreateModel(file);

        // It should load with that value
        const cells = model.cells;
        expect(cells).to.be.lengthOf(2);

        // And global storage should be empty
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(globalMemento.get(`notebook-storage-file::///bar.ipynb`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
    });
});
