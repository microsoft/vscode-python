// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { Position, Range } from 'vscode';

import { IConfigurationService, IDataScienceSettings, IPythonSettings } from '../../../client/common/types';
import { CellHashProvider } from '../../../client/datascience/editor-integration/cellhashprovider';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-window/interactiveWindowTypes';
import { MockDocumentManager } from '../mockDocumentManager';

// tslint:disable-next-line: max-func-body-length
suite('CellHashProvider Unit Tests', () => {
    let hashProvider: CellHashProvider;
    let documentManager: MockDocumentManager;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let dataScienceSettings: TypeMoq.IMock<IDataScienceSettings>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;

    setup(() => {
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
        dataScienceSettings.setup(d => d.enabled).returns(() => true);
        pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        documentManager = new MockDocumentManager();
        hashProvider = new CellHashProvider(documentManager, configurationService.object);
    });

     test('Add a cell and edit it', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Edit the first cell, removing it
        documentManager.changeDocument('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Get our hashes again. The line number should change
        // We should have a single hash
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

     });

     test('Add a cell, delete it, and recreate it', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the second cell
        documentManager.changeDocument('foo.py', new Range(new Position(3, 0), new Position(3, 0)), 'print ("bob")\r\n');

        // Should be no hashes now
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Hash should be gone');

        // Undo the last change
        documentManager.changeDocument('foo.py', new Range(new Position(3, 0), new Position(3, 15)), '');

        // Hash should reappear
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Delete code below', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        documentManager.changeDocument('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Should be the same hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Delete the first cell
        documentManager.changeDocument('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Hash should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Modify code after sending twice', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        documentManager.changeDocument('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Send the third cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Should be two hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 5, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');

        // Delete the first cell
        documentManager.changeDocument('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Hashes should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 5, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Run same cell twice', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Add a second cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Add this code a second time
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 3, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 5, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Two files with same cells', () => {
        const file1 = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const file2 = file1;
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our documents
        documentManager.addDocument(file1, 'foo.py');
        documentManager.addDocument(file2, 'bar.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'bar.py', line: 2 });

        // Add a second cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Add this code a second time
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 2, 'Wrong number of hashes');
        const fooHash = hashes.find(h => h.file === 'foo.py');
        const barHash = hashes.find(h => h.file === 'bar.py');
        assert.ok(fooHash, 'No hash for foo.py');
        assert.ok(barHash, 'No hash for bar.py');
        assert.equal(fooHash!.hashes.length, 2, 'Not enough hashes found');
        assert.equal(fooHash!.hashes[0].line, 3, 'Wrong start line');
        assert.equal(fooHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(fooHash!.hashes[0].executionCount, 4, 'Wrong execution count');
        assert.equal(fooHash!.hashes[1].line, 5, 'Wrong start line');
        assert.equal(fooHash!.hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(fooHash!.hashes[1].executionCount, 3, 'Wrong execution count');
        assert.equal(barHash!.hashes.length, 1, 'Not enough hashes found');
        assert.equal(barHash!.hashes[0].line, 3, 'Wrong start line');
        assert.equal(barHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(barHash!.hashes[0].executionCount, 2, 'Wrong execution count');
    });
});
