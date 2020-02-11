// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as TypeMoq from 'typemoq';

import { IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService } from '../../client/common/types';
import { Identifiers } from '../../client/datascience/constants';
import { IntellisenseProvider } from '../../client/datascience/interactive-common/intellisense/intellisenseProvider';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    ICell,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterExecution
} from '../../client/datascience/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { createEmptyCell, generateTestCells } from '../../datascience-ui/interactive-common/mainState';
import { MockAutoSelectionService } from '../mocks/autoSelector';
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
    let intellisenseProvider: IInteractiveWindowListener;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let languageServerCache: MockLanguageServerCache;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let jupyterExecution: TypeMoq.IMock<IJupyterExecution>;
    let interactiveWindowProvider: TypeMoq.IMock<IInteractiveWindowProvider>;
    const pythonSettings = new (class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    })(undefined, new MockAutoSelectionService());

    setup(() => {
        languageServerCache = new MockLanguageServerCache();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        jupyterExecution = TypeMoq.Mock.ofType<IJupyterExecution>();
        interactiveWindowProvider = TypeMoq.Mock.ofType<IInteractiveWindowProvider>();

        pythonSettings.jediEnabled = false;
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings);
        workspaceService.setup(w => w.rootPath).returns(() => '/foo/bar');

        intellisenseProvider = new IntellisenseProvider(
            workspaceService.object,
            fileSystem.object,
            jupyterExecution.object,
            interactiveWindowProvider.object,
            interpreterService.object,
            languageServerCache
        );
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
        return sendMessage(InteractiveWindowMessages.AddCell, {
            fullText: code,
            currentText: code,
            cell: createEmptyCell(id, null)
        });
    }

    function updateCell(newCode: string, oldCode: string, id: string): Promise<void> {
        const oldSplit = oldCode.split('\n');
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: oldSplit.length,
                endColumn: oldSplit[oldSplit.length - 1].length + 1
            },
            rangeOffset: 0,
            rangeLength: oldCode.length,
            text: newCode
        };
        return sendMessage(InteractiveWindowMessages.EditCell, { changes: [change], id });
    }

    function addCode(code: string, line: number, pos: number, offset: number): Promise<void> {
        if (!line || !pos) {
            throw new Error('Invalid line or position data');
        }
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: line,
                startColumn: pos,
                endLineNumber: line,
                endColumn: pos
            },
            rangeOffset: offset,
            rangeLength: 0,
            text: code
        };
        return sendMessage(InteractiveWindowMessages.EditCell, { changes: [change], id: Identifiers.EditCellId });
    }

    function removeCode(line: number, startPos: number, endPos: number, length: number): Promise<void> {
        if (!line || !startPos || !endPos) {
            throw new Error('Invalid line or position data');
        }
        const change: monacoEditor.editor.IModelContentChange = {
            range: {
                startLineNumber: line,
                startColumn: startPos,
                endLineNumber: line,
                endColumn: endPos
            },
            rangeOffset: startPos,
            rangeLength: length,
            text: ''
        };
        return sendMessage(InteractiveWindowMessages.EditCell, { changes: [change], id: Identifiers.EditCellId });
    }

    function removeCell(id: string): Promise<void> {
        return sendMessage(InteractiveWindowMessages.RemoveCell, { id });
    }

    function removeAllCells(): Promise<void> {
        return sendMessage(InteractiveWindowMessages.DeleteAllCells);
    }

    function swapCells(id1: string, id2: string): Promise<void> {
        return sendMessage(InteractiveWindowMessages.SwapCells, { firstCellId: id1, secondCellId: id2 });
    }

    function insertCell(id: string, code: string, codeCellAbove?: string): Promise<void> {
        return sendMessage(InteractiveWindowMessages.InsertCell, {
            cell: createEmptyCell(id, null),
            index: 0,
            code,
            codeCellAboveId: codeCellAbove
        });
    }

    function loadAllCells(cells: ICell[]): Promise<void> {
        return sendMessage(InteractiveWindowMessages.LoadAllCellsComplete, { cells });
    }

    function getDocumentContents(): string {
        return languageServerCache.getMockServer().getDocumentContents();
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
        await removeCell('1');
        expect(getDocumentContents()).to.be.eq('import sys\nsys', 'Removing a cell broken');
        await addCell('import sys', '2');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nsys', 'Adding a cell broken');
        await addCell('import bar', '3');
        expect(getDocumentContents()).to.be.eq('import sys\nimport sys\nimport bar\nsys', 'Adding a cell broken');
        await removeCell('1');
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
        const cells = generateTestCells('foo.py', 1);
        await loadAllCells(cells);
        expect(getDocumentContents()).to.be.eq(TestCellContents, 'Load all cells is failing');
        await removeAllCells();
        expect(getDocumentContents()).to.be.eq('', 'Remove all cells is failing');
        await insertCell('6', 'foo');
        expect(getDocumentContents()).to.be.eq('foo\n', 'Insert after remove');
        await insertCell('7', 'bar', '6');
        expect(getDocumentContents()).to.be.eq('foo\nbar\n', 'Double insert after remove');
    });

    test('Swap cells around', async () => {
        const cells = generateTestCells('foo.py', 1);
        await loadAllCells(cells);
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
        const cells = generateTestCells('foo.py', 1);
        await loadAllCells(cells);
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
        await removeCell('7');
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
});
