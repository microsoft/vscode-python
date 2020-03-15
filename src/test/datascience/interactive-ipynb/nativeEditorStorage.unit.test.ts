// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import * as typemoq from 'typemoq';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    EventEmitter,
    TextEditor,
    Uri,
    WorkspaceConfiguration
} from 'vscode';

import { DocumentManager } from '../../../client/common/application/documentManager';
import {
    IDocumentManager,
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
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, ICryptoUtils, IDisposable, IExtensionContext } from '../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import {
    IEditorContentChange,
    InteractiveWindowMessages
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditorStorage } from '../../../client/datascience/interactive-ipynb/nativeEditorStorage';
import { JupyterExecutionFactory } from '../../../client/datascience/jupyter/jupyterExecutionFactory';
import { ICell, IJupyterExecution, INotebookServerOptions } from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { concatMultilineStringInput } from '../../../datascience-ui/common';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { MockMemento } from '../../mocks/mementos';

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
suite('Data Science - Native Editor Storage', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let docManager: IDocumentManager;
    let interpreterService: IInterpreterService;
    let webPanelProvider: IWebPanelProvider;
    let executionProvider: IJupyterExecution;
    let globalMemento: MockMemento;
    let localMemento: MockMemento;
    let context: typemoq.IMock<IExtensionContext>;
    let crypto: ICryptoUtils;
    let lastWriteFileValue: any;
    let wroteToFileEvent: EventEmitter<string> = new EventEmitter<string>();
    let filesConfig: MockWorkspaceConfiguration | undefined;
    let testIndex = 0;
    let storage: NativeEditorStorage;
    const disposables: IDisposable[] = [];
    const baseUri = Uri.parse('file:///foo.ipynb');
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
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        docManager = mock(DocumentManager);
        workspace = mock(WorkspaceService);
        interpreterService = mock(InterpreterService);
        webPanelProvider = mock(WebPanelProvider);
        executionProvider = mock(JupyterExecutionFactory);
        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();

        context
            .setup(c => c.globalStoragePath)
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
        lastWriteFileValue = baseFile;
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

        storage = new NativeEditorStorage(
            instance(executionProvider),
            fileSystem.object, // Use typemoq so can save values in returns
            instance(crypto),
            context.object,
            globalMemento,
            localMemento
        );
    });

    teardown(() => {
        globalMemento.clear();
        sinon.reset();
        disposables.forEach(d => d.dispose());
    });

    function insertCell(index: number, code: string) {
        return storage.update({
            source: 'user',
            kind: 'insert',
            oldDirty: storage.isDirty,
            newDirty: true,
            cell: createEmptyCell(code, 1),
            index
        });
    }

    function swapCells(first: string, second: string) {
        return storage.update({
            source: 'user',
            kind: 'swap',
            oldDirty: storage.isDirty,
            newDirty: true,
            firstCellId: first,
            secondCellId: second
        });
    }

    function editCell(changes: IEditorContentChange[], cell: ICell, _newCode: string) {
        return storage.update({
            source: 'user',
            kind: 'edit',
            oldDirty: storage.isDirty,
            newDirty: true,
            forward: changes,
            reverse: changes,
            id: cell.id
        });
    }

    function removeCell(index: number, cell: ICell) {
        return storage.update({
            source: 'user',
            kind: 'remove',
            oldDirty: storage.isDirty,
            newDirty: true,
            index,
            cell
        });
    }

    function deleteAllCells() {
        return storage.update({
            source: 'user',
            kind: 'remove_all',
            oldDirty: storage.isDirty,
            newDirty: true,
            oldCells: storage.cells,
            newCellId: '1'
        });
    }

    test('Create new editor and add some cells', async () => {
        await storage.load(baseUri);
        insertCell(0, '1');
        const cells = storage.cells;
        expect(cells).to.be.lengthOf(4);
        expect(storage.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(cells[0].id).to.be.match(/1/);
    });

    test('Move cells around', async () => {
        await storage.load(baseUri);
        swapCells('NotebookImport#0', 'NotebookImport#1');
        const cells = storage.cells;
        expect(cells).to.be.lengthOf(3);
        expect(storage.isDirty).to.be.equal(true, 'Editor should be dirty');
        expect(cells[0].id).to.be.match(/NotebookImport#1/);
    });

    test('Edit/delete cells', async () => {
        await storage.load(baseUri);
        expect(storage.isDirty).to.be.equal(false, 'Editor should not be dirty');
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
            storage.cells[1],
            'a'
        );
        let cells = storage.cells;
        expect(cells).to.be.lengthOf(3);
        expect(cells[1].id).to.be.match(/NotebookImport#1/);
        expect(concatMultilineStringInput(cells[1].data.source)).to.be.equals('b=2\nab');
        expect(storage.isDirty).to.be.equal(true, 'Editor should be dirty');
        removeCell(0, cells[0]);
        cells = storage.cells;
        expect(cells).to.be.lengthOf(2);
        expect(cells[0].id).to.be.match(/NotebookImport#1/);
        deleteAllCells();
        cells = storage.cells;
        expect(cells).to.be.lengthOf(1);
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
        await storage.load(file);

        // It should load with that value
        const cells = storage.cells;
        expect(cells).to.be.lengthOf(2);
    });

    test('Opening file with global storage but no global file will still open with old contents', async () => {
        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

        // Initially nothing in memento
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;

        // Put the regular file into the global storage
        await globalMemento.update(`notebook-storage-${file.toString()}`, {
            contents: differentFile,
            lastModifiedTimeMs: Date.now()
        });
        await storage.load(file);

        // It should load with that value
        const cells = storage.cells;
        expect(cells).to.be.lengthOf(2);
    });

    test('Opening file with global storage will clear all global storage', async () => {
        await filesConfig?.update('autoSave', 'off');

        // This test is really for making sure when a user upgrades to a new extension, we still have their old storage
        const file = Uri.parse('file:///foo.ipynb');
        fileSystem.setup(f => f.stat(typemoq.It.isAny())).returns(() => Promise.resolve({ mtime: 1 } as any));

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

        await storage.load(file);

        // It should load with that value
        const cells = storage.cells;
        expect(cells).to.be.lengthOf(2);

        // And global storage should be empty
        expect(globalMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
        expect(globalMemento.get(`notebook-storage-file::///bar.ipynb`)).to.be.undefined;
        expect(localMemento.get(`notebook-storage-${file.toString()}`)).to.be.undefined;
    });
});
