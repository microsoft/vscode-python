// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid/v4';

import { instance, mock } from 'ts-mockito';
import { Uri } from 'vscode';
import { LanguageServerType } from '../../client/activation/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IConfigurationService, IInstaller } from '../../client/common/types';
import { Identifiers } from '../../client/datascience/constants';
import { IntellisenseDocument } from '../../client/datascience/interactive-common/intellisense/intellisenseDocument';
import { IntellisenseProvider } from '../../client/datascience/interactive-common/intellisense/intellisenseProvider';
import {
    IEditorContentChange,
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { ICell, IDataScienceFileSystem, INotebookProvider } from '../../client/datascience/types';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { IInterpreterSelector } from '../../client/interpreter/configuration/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../client/interpreter/locators/types';
import { createEmptyCell, generateTestCells } from '../../datascience-ui/interactive-common/mainState';
import { generateReverseChange, IMonacoTextModel } from '../../datascience-ui/react-common/monacoHelpers';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { MockExtensions } from './mockExtensions';
import { MockJupyterExtensionIntegration } from './mockJupyterExtensionIntegration';
import { MockLanguageServerCache } from './mockLanguageServerCache';

// tslint:disable:no-any unified-signatures
const TestCellContents = `myvar = """ # Lorem Ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
","Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""
df
df
`;

// tslint:disable-next-line: max-func-body-length
suite('DataScience Intellisense Unit Tests', () => {
    let intellisenseProvider: IntellisenseProvider;
    let intellisenseDocument: IntellisenseDocument;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let languageServerCache: MockLanguageServerCache;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let fileSystem: TypeMoq.IMock<IDataScienceFileSystem>;
    let notebookProvider: TypeMoq.IMock<INotebookProvider>;
    let cells: ICell[] = [createEmptyCell(Identifiers.EditCellId, null)];
    const pythonSettings = new (class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    })(undefined, new MockAutoSelectionService());

    setup(async () => {
        languageServerCache = new MockLanguageServerCache();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        fileSystem = TypeMoq.Mock.ofType<IDataScienceFileSystem>();
        notebookProvider = TypeMoq.Mock.ofType<INotebookProvider>();
        const variableProvider = mock(JupyterVariables);

        pythonSettings.languageServer = LanguageServerType.Microsoft;
        configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings);
        workspaceService.setup((w) => w.rootPath).returns(() => '/foo/bar');
        fileSystem
            .setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((f1: Uri, f2: Uri) => {
                return f1?.fsPath?.toLowerCase() === f2.fsPath?.toLowerCase();
            });
        const selector = TypeMoq.Mock.ofType<IInterpreterSelector>();
        const storeInterpreter = TypeMoq.Mock.ofType<IWindowsStoreInterpreter>();
        const installer = TypeMoq.Mock.ofType<IInstaller>();
        const envService = TypeMoq.Mock.ofType<IEnvironmentActivationService>();

        const extensionRegister = new MockJupyterExtensionIntegration(
            new MockExtensions(),
            interpreterService.object,
            selector.object,
            storeInterpreter.object,
            installer.object,
            envService.object,
            languageServerCache
        );

        intellisenseProvider = new IntellisenseProvider(
            workspaceService.object,
            fileSystem.object,
            notebookProvider.object,
            interpreterService.object,
            extensionRegister,
            instance(variableProvider)
        );
        intellisenseDocument = await intellisenseProvider.getDocument();
    });

    function sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        type: T,
        payload?: M[T]
    ): Promise<void> {
        const result = languageServerCache.getMockServer().waitForNotification();
        intellisenseProvider.onMessage(type.toString(), payload);
        return result;
    }

    function addCell(code: string, id: string): Promise<void> {
        const cell = createEmptyCell(id, null);
        cell.data.source = code;
        const result = sendMessage(InteractiveWindowMessages.UpdateModel, {
            source: 'user',
            kind: 'add',
            oldDirty: false,
            newDirty: true,
            fullText: code,
            currentText: code,
            cell
        });
        cells.splice(cells.length - 1, 0, cell);
        return result;
    }

    function generateModel(doc: IntellisenseDocument): IMonacoTextModel {
        const code = doc.getText();
        return {
            id: '1',
            getValue: () => code,
            getValueLength: () => code.length,
            getVersionId: () => doc.version,
            getPositionAt: (o: number) => {
                const p = doc.positionAt(o);
                return { lineNumber: p.line + 1, column: p.character + 1 };
            }
        };
    }

    function sendUpdate(
        id: string,
        oldText: string,
        doc: IntellisenseDocument,
        change: IEditorContentChange,
        source: 'user' | 'undo' | 'redo' = 'user'
    ) {
        const reverse = {
            ...generateReverseChange(oldText, generateModel(doc), change),
            position: { lineNumber: 1, column: 1 }
        };
        return sendMessage(InteractiveWindowMessages.UpdateModel, {
            source,
            kind: 'edit',
            oldDirty: false,
            newDirty: true,
            forward: [change],
            reverse: [reverse],
            id
        });
    }

    function updateCell(
        newCode: string,
        oldCode: string,
        id: string,
        source: 'user' | 'undo' | 'redo' = 'user'
    ): Promise<void> {
        const oldSplit = oldCode.split('\n');
        const change: IEditorContentChange = {
            range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: oldSplit.length,
                endColumn: oldSplit[oldSplit.length - 1].length + 1
            },
            rangeOffset: 0,
            rangeLength: oldCode.length,
            text: newCode,
            position: {
                column: 1,
                lineNumber: 1
            }
        };
        return sendUpdate(id, oldCode, getDocument(), change, source);
    }

    function addCode(code: string, line: number, pos: number, offset: number): Promise<void> {
        if (!line || !pos) {
            throw new Error('Invalid line or position data');
        }
        const change: IEditorContentChange = {
            range: {
                startLineNumber: line,
                startColumn: pos,
                endLineNumber: line,
                endColumn: pos
            },
            rangeOffset: offset,
            rangeLength: 0,
            text: code,
            position: {
                column: 1,
                lineNumber: 1
            }
        };
        return sendMessage(InteractiveWindowMessages.UpdateModel, {
            source: 'user',
            kind: 'edit',
            oldDirty: false,
            newDirty: true,
            forward: [change],
            reverse: [change],
            id: cells[cells.length - 1].id
        });
    }

    function removeCode(line: number, startPos: number, endPos: number, length: number): Promise<void> {
        if (!line || !startPos || !endPos) {
            throw new Error('Invalid line or position data');
        }
        const change: IEditorContentChange = {
            range: {
                startLineNumber: line,
                startColumn: startPos,
                endLineNumber: line,
                endColumn: endPos
            },
            rangeOffset: startPos,
            rangeLength: length,
            text: '',
            position: {
                column: 1,
                lineNumber: 1
            }
        };
        return sendUpdate(cells[cells.length - 1].id, '', getDocument(), change);
    }

    async function removeCell(
        cell: ICell | undefined,
        oldIndex: number = -1,
        source: 'user' | 'undo' | 'redo' = 'user'
    ): Promise<number> {
        if (cell) {
            let index = cells.findIndex((c) => c.id === cell.id);
            if (index < 0) {
                index = oldIndex;
            } else {
                cells.splice(index, 1);
            }
            await sendMessage(InteractiveWindowMessages.UpdateModel, {
                source,
                kind: 'remove',
                oldDirty: false,
                newDirty: true,
                cell,
                index
            });
            return index;
        }
        return -1;
    }

    function removeAllCells(source: 'user' | 'undo' | 'redo' = 'user', oldCells: ICell[] = cells): Promise<void> {
        return sendMessage(InteractiveWindowMessages.UpdateModel, {
            source,
            kind: 'remove_all',
            oldDirty: false,
            newDirty: true,
            oldCells,
            newCellId: uuid()
        });
    }

    function swapCells(id1: string, id2: string, source: 'user' | 'undo' | 'redo' = 'user'): Promise<void> {
        return sendMessage(InteractiveWindowMessages.UpdateModel, {
            source,
            kind: 'swap',
            oldDirty: false,
            newDirty: true,
            firstCellId: id1,
            secondCellId: id2
        });
    }

    function insertCell(
        id: string,
        code: string,
        codeCellAbove?: string,
        source: 'user' | 'undo' | 'redo' = 'user',
        end?: boolean
    ): Promise<void> {
        const cell = createEmptyCell(id, null);
        cell.data.source = code;
        const index = codeCellAbove ? cells.findIndex((c) => c.id === codeCellAbove) : end ? cells.length : 0;
        if (source === 'undo') {
            cells = cells.filter((c) => c.id !== id);
        } else {
            cells.splice(index, 0, cell);
        }
        return sendMessage(InteractiveWindowMessages.UpdateModel, {
            source,
            kind: 'insert',
            oldDirty: false,
            newDirty: true,
            codeCellAboveId: codeCellAbove,
            cell,
            index
        });
    }

    function loadAllCells(allCells: ICell[]): Promise<void> {
        cells = allCells;
        intellisenseProvider.onMessage(InteractiveWindowMessages.NotebookIdentity, {
            resource: Uri.parse('file:///foo.ipynb'),
            type: 'native'
        });

        // Load all cells will actually respond with a notification, NotebookIdentity won't so don't wait for it.
        return sendMessage(InteractiveWindowMessages.LoadAllCellsComplete, { cells });
    }

    function getDocumentContents(): string {
        return languageServerCache.getMockServer().getDocumentContents();
    }

    function getDocument(): IntellisenseDocument {
        return intellisenseDocument;
    }

    test('Add a single cell', async () => {
        await addCell('import sys\n\n', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n\n\n', 'Document not set');
    });

    test('Add two cells', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCell('import sys', '2');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\n', 'Document not set after double');
    });

    test('Add a cell and edit', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('i', 1, 1, 0);
        expect(getDocumentContents()).to.be.eq('import sys\ni', 'Document not set after edit');
        await addCode('m', 1, 2, 1);
        expect(getDocumentContents()).to.be.eq('import sys\nim', 'Document not set after edit');
        await addCode('\n', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('import sys\nim\n', 'Document not set after edit');
    });

    test('Add a cell and remove', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('i', 1, 1, 0);
        expect(getDocumentContents()).to.be.eq('import sys\ni', 'Document not set after edit');
        await removeCode(1, 1, 2, 1);
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set after edit');
        await addCode('\n', 1, 1, 0);
        expect(getDocumentContents()).to.be.eq('import sys\n\n', 'Document not set after edit');
    });

    test('Remove a section in the middle', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('import os', 1, 1, 0);
        expect(getDocumentContents()).to.be.eq('import sys\nimport os', 'Document not set after edit');
        await removeCode(1, 4, 7, 4);
        expect(getDocumentContents()).to.be.eq('import sys\nimp os', 'Document not set after edit');
    });

    test('Remove a bunch in a row', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('p', 1, 1, 0);
        await addCode('r', 1, 2, 1);
        await addCode('i', 1, 3, 2);
        await addCode('n', 1, 4, 3);
        await addCode('t', 1, 5, 4);
        expect(getDocumentContents()).to.be.eq('import sys\nprint', 'Document not set after edit');
        await removeCode(1, 5, 6, 1);
        await removeCode(1, 4, 5, 1);
        await removeCode(1, 3, 4, 1);
        await removeCode(1, 2, 3, 1);
        await removeCode(1, 1, 2, 1);
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set after edit');
    });
    test('Remove from a line', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await addCode('\n', 1, 4, 3);
        expect(getDocumentContents()).to.be.eq('import sys\nsys\n', 'Document not set after edit');
        await addCode('s', 2, 1, 3);
        await addCode('y', 2, 2, 4);
        await addCode('s', 2, 3, 5);
        expect(getDocumentContents()).to.be.eq('import sys\nsys\nsys', 'Document not set after edit');
        await removeCode(1, 3, 4, 1);
        expect(getDocumentContents()).to.be.eq('import sys\nsy\nsys', 'Document not set after edit');
    });

    test('Add cell after adding code', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await addCell('import sys', '2');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nsys', 'Adding a second cell broken');
    });

    test('Collapse expand cell', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await updateCell('import sys\nsys.version_info', 'import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Readding a cell broken');
        await updateCell('import sys', 'import sys\nsys.version_info', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Collapsing a cell broken');
        await updateCell('import sys', 'import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Updating a cell broken');
    });

    test('Collapse expand cell after adding code', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await updateCell('import sys\nsys.version_info', 'import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Readding a cell broken');
        await updateCell('import sys', 'import sys\nsys.version_info', '1');
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Collapsing a cell broken');
        await updateCell('import sys', 'import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Updating a cell broken');
    });

    test('Add a cell and remove it', async () => {
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\n', 'Document not set');
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set after edit');
        await removeCell(cells.find((c) => c.id === '1'));
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Removing a cell broken');
        await addCell('import sys', '2');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nsys', 'Adding a cell broken');
        await addCell('import bar', '3');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nimport bar\nsys', 'Adding a cell broken');
        await removeCell(cells.find((c) => c.id === '1'));
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nimport bar\nsys', 'Removing a cell broken');
    });

    test('Add a bunch of cells and remove them', async () => {
        await addCode('s', 1, 1, 0);
        await addCode('y', 1, 2, 1);
        await addCode('s', 1, 3, 2);
        expect(getDocumentContents()).to.be.eq('sys', 'Document not set after edit');
        await addCell('import sys', '1');
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Document not set');
        await addCell('import foo', '2');
        expect(getDocumentContents()).to.be.eq('import sys\nimport foo\nsys', 'Document not set');
        await addCell('import bar', '3');
        expect(getDocumentContents()).to.be.eq('import sys\nimport foo\nimport bar\nsys', 'Document not set');
        await removeAllCells();
        expect(getDocumentContents()).to.be.eq('import sys\nimport foo\nimport bar\nsys', 'Removing all cells broken');
        await addCell('import baz', '3');
        expect(getDocumentContents()).to.be.eq(
            'import sys\nimport foo\nimport bar\nimport baz\nsys',
            'Document not set'
        );
    });

    test('Load remove and insert', async () => {
        const test = generateTestCells('foo.py', 1);
        await loadAllCells(test);
        expect(getDocumentContents()).to.be.eq(TestCellContents, 'Load all cells is failing');
        await removeAllCells();
        expect(getDocumentContents()).to.be.eq('', 'Remove all cells is failing');
        await insertCell('6', 'foo');
        expect(getDocumentContents()).to.be.eq('foo\n', 'Insert after remove');
        await insertCell('7', 'bar', '6');
        expect(getDocumentContents()).to.be.eq('foo\nbar\n', 'Double insert after remove');
    });

    test('Swap cells around', async () => {
        const test = generateTestCells('foo.py', 1);
        await loadAllCells(test);
        await swapCells('0', '1'); // 2nd cell is markdown
        expect(getDocumentContents()).to.be.eq(TestCellContents, 'Swap cells should skip swapping on markdown');
        await swapCells('0', '2');
        const afterSwap = `df
myvar = """ # Lorem Ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
","Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""
df
`;
        expect(getDocumentContents()).to.be.eq(afterSwap, 'Swap cells failed');
        await swapCells('0', '2');
        expect(getDocumentContents()).to.be.eq(TestCellContents, 'Swap cells back failed');
    });

    test('Insert and swap', async () => {
        const test = generateTestCells('foo.py', 1);
        await loadAllCells(test);
        expect(getDocumentContents()).to.be.eq(TestCellContents, 'Load all cells is failing');
        await insertCell('6', 'foo');
        const afterInsert = `foo
myvar = """ # Lorem Ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
","Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""
df
df
`;
        expect(getDocumentContents()).to.be.eq(afterInsert, 'Insert cell failed');
        await insertCell('7', 'foo', '0');
        const afterInsert2 = `foo
myvar = """ # Lorem Ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
","Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""
foo
df
df
`;
        expect(getDocumentContents()).to.be.eq(afterInsert2, 'Insert2 cell failed');
        await removeCell(cells.find((c) => c.id === '7'));
        expect(getDocumentContents()).to.be.eq(afterInsert, 'Remove 2 cell failed');
        await swapCells('0', '2');
        const afterSwap = `foo
df
myvar = """ # Lorem Ipsum

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
","Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""
df
`;
        expect(getDocumentContents()).to.be.eq(afterSwap, 'Swap cell failed');
    });

    test('Edit and undo', async () => {
        const loadable = [createEmptyCell('0', null), createEmptyCell('1', null)];
        loadable[0].data.source = 'a=1\na';
        loadable[1].data.source = 'b=2\nb';
        await loadAllCells(loadable);
        const startContent = `a=1
a
b=2
b
`;
        expect(getDocumentContents()).to.be.eq(startContent, 'Load all cells is failing');
        await swapCells('0', '1');
        const afterSwap = `b=2
b
a=1
a
`;
        expect(getDocumentContents()).to.be.eq(afterSwap, 'Swap cell failed');
        await swapCells('0', '1', 'undo');
        expect(getDocumentContents()).to.be.eq(startContent, 'Swap cell undo failed');
        await updateCell('a=4\na', 'a=1\na', '0');
        const afterUpdate = `a=4
a
b=2
b
`;
        expect(getDocumentContents()).to.be.eq(afterUpdate, 'Edit cell failed');
        await updateCell('a=4\na', 'a=1\na', '0', 'undo');
        expect(getDocumentContents()).to.be.eq(startContent, 'Edit undo cell failed');

        const afterInsert = `a=1
a
b=2
b
c=5
c
`;
        await insertCell('2', 'c=5\nc', undefined, 'user', true);
        expect(getDocumentContents()).to.be.eq(afterInsert, 'Insert cell failed');
        await insertCell('2', 'c=5\nc', undefined, 'undo', true);
        expect(getDocumentContents()).to.be.eq(startContent, 'Insert cell update failed');
        const oldCells = [...cells];
        await removeAllCells();
        expect(getDocumentContents()).to.be.eq('', 'Remove all failed');
        await removeAllCells('undo', oldCells);
        expect(getDocumentContents()).to.be.eq(startContent, 'Remove all undo failed');
        const cell = cells.find((c) => c.id === '1');
        const oldIndex = await removeCell(cell);
        const afterRemove = `a=1
a
`;
        expect(getDocumentContents()).to.be.eq(afterRemove, 'Remove failed');
        await removeCell(cell, oldIndex, 'undo');
        expect(getDocumentContents()).to.be.eq(startContent, 'Remove undo failed');
    });
});
