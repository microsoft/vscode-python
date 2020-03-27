// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { Position, Range, Uri } from 'vscode';

import { IDebugService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IDataScienceSettings, IPythonSettings } from '../../../client/common/types';
import { CellHashLogger } from '../../../client/datascience/editor-integration/cellhashLogger';
import { CellHashProvider } from '../../../client/datascience/editor-integration/cellhashprovider';
import {
    InteractiveWindowMessages,
    SysInfoReason,
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell, ICellHashListener, IFileHashes } from '../../../client/datascience/types';
import { MockDocumentManager } from '../mockDocumentManager';

class HashListener implements ICellHashListener {
    public lastHashes: IFileHashes[] = [];

    public async hashesUpdated(hashes: IFileHashes[]): Promise<void> {
        this.lastHashes = hashes;
    }
}

// tslint:disable-next-line: max-func-body-length
suite('CellHashProvider Unit Tests', () => {
    let hashProvider: CellHashProvider;
    let hashLogger: CellHashLogger;
    let documentManager: MockDocumentManager;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let dataScienceSettings: TypeMoq.IMock<IDataScienceSettings>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let debugService: TypeMoq.IMock<IDebugService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    const hashListener: HashListener = new HashListener();
    setup(() => {
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
        debugService = TypeMoq.Mock.ofType<IDebugService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        dataScienceSettings.setup((d) => d.enabled).returns(() => true);
        pythonSettings.setup((p) => p.datascience).returns(() => dataScienceSettings.object);
        configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        debugService.setup((d) => d.activeDebugSession).returns(() => undefined);
        fileSystem.setup((d) => d.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
        documentManager = new MockDocumentManager();
        hashProvider = new CellHashProvider(
            documentManager,
            configurationService.object,
            debugService.object,
            fileSystem.object,
            [hashListener]
        );
        hashLogger = new CellHashLogger(hashProvider);
    });

    function addSingleChange(file: string, range: Range, newText: string) {
        documentManager.changeDocument(file, [{ range, newText }]);
    }

    function sendCode(code: string, line: number, file?: string): Promise<void> {
        const cell: ICell = {
            file: Uri.file(file ? file : 'foo.py').fsPath,
            line,
            data: {
                source: code,
                cell_type: 'code',
                metadata: {},
                outputs: [],
                execution_count: 1,
            },
            id: '1',
            state: CellState.init,
        };
        return hashLogger.preExecute(cell, false);
    }

    test('Add a cell and edit it', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Edit the first cell, removing it
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(2, 0)), '');

        // Get our hashes again. The line number should change
        // We should have a single hash
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 2, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Add a cell, delete it, and recreate it', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the second cell
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 0)), 'print ("bob")\r\n');

        // Should be no hashes now
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Hash should be gone');

        // Undo the last change
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(4, 0)), '');

        // Hash should reappear
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Delete code below', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        addSingleChange('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Should be the same hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Delete the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(2, 0)), '');

        // Hash should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 2, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Modify code after sending twice', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        addSingleChange('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Send the third cell
        await sendCode(thirdCell, 4);

        // Should be two hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 6, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');

        // Delete the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(2, 0)), '');

        // Hashes should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 2, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 5, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Run same cell twice', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // Add a second cell
        await sendCode(thirdCell, 4);

        // Add this code a second time
        await sendCode(code, 2);

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 3, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 6, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 6, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Two files with same cells', async () => {
        const file1 = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const file2 = file1;
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our documents
        documentManager.addDocument(file1, 'foo.py');
        documentManager.addDocument(file2, 'bar.py');

        // Add this code
        await sendCode(code, 2);
        await sendCode(code, 2, 'bar.py');

        // Add a second cell
        await sendCode(thirdCell, 4);

        // Add this code a second time
        await sendCode(code, 2);

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 2, 'Wrong number of hashes');
        const fooHash = hashes.find((h) => h.file === Uri.file('foo.py').fsPath);
        const barHash = hashes.find((h) => h.file === Uri.file('bar.py').fsPath);
        assert.ok(fooHash, 'No hash for foo.py');
        assert.ok(barHash, 'No hash for bar.py');
        assert.equal(fooHash!.hashes.length, 2, 'Not enough hashes found');
        assert.equal(fooHash!.hashes[0].line, 4, 'Wrong start line');
        assert.equal(fooHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(fooHash!.hashes[0].executionCount, 4, 'Wrong execution count');
        assert.equal(fooHash!.hashes[1].line, 6, 'Wrong start line');
        assert.equal(fooHash!.hashes[1].endLine, 6, 'Wrong end line');
        assert.equal(fooHash!.hashes[1].executionCount, 3, 'Wrong execution count');
        assert.equal(barHash!.hashes.length, 1, 'Not enough hashes found');
        assert.equal(barHash!.hashes[0].line, 4, 'Wrong start line');
        assert.equal(barHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(barHash!.hashes[0].executionCount, 2, 'Wrong execution count');
    });

    test('Delete cell with dupes in code, put cell back', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("foo")';

        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Modify the code
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 1)), '');

        // Should have zero hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Put back the original cell
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 0)), 'p');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Modify the code
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 1)), '');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Remove the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(2, 0)), '');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Put back the original cell
        addSingleChange('foo.py', new Range(new Position(1, 0), new Position(1, 0)), 'p');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 2, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Add a cell and edit different parts of it', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Edit the cell we added
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 0)), '#');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 1)), '');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 1)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 0)), '#');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 1), new Position(2, 2)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 1), new Position(2, 1)), '%');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 2), new Position(2, 3)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 2), new Position(2, 2)), '%');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 3), new Position(2, 4)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 3), new Position(2, 3)), '\r');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 4), new Position(2, 5)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 4), new Position(2, 4)), '\n');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
    });

    test('Add a cell and edit it to be exactly the same', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Replace with the same cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(4, 0)), file);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
    });

    test('Add a cell and edit it to not be exactly the same', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const file2 = '#%%\r\nprint("fooze")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Replace with the new code
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(4, 0)), file2);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Hashes should be gone');

        // Put back old code
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(4, 0)), file);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Apply multiple edits at once', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Apply a couple of edits at once
        documentManager.changeDocument('foo.py', [
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n',
            },
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n',
            },
        ]);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 8, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 8, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        documentManager.changeDocument('foo.py', [
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n',
            },
            {
                range: new Range(new Position(0, 0), new Position(2, 0)),
                newText: '',
            },
        ]);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 8, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 8, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Restart kernel', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(code, 2);

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 4, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Restart the kernel
        hashProvider.onMessage(InteractiveWindowMessages.AddedSysInfo, { type: SysInfoReason.Restart });

        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Restart should have cleared');
    });

    test('More than one cell in range', async () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        await sendCode(file, 0);

        // We should have a single hash
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 2, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });
});
