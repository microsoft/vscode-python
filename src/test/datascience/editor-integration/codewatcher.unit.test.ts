// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// tslint:disable:max-func-body-length no-trailing-whitespace no-multiline-string
// Disable whitespace / multiline as we use that to pass in our fake file strings
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Range, Selection, TextDocument, TextEditor, TextLine } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../../client/common/application/types';
import { ILogger } from '../../../client/common/types';
import { Commands } from '../../../client/datascience/constants';
import { CodeWatcher } from '../../../client/datascience/editor-integration/codewatcher';
import { IHistory, IHistoryProvider } from '../../../client/datascience/types';

suite('DataScience Code Watcher Unit Tests', () => {
    let codeWatcher: CodeWatcher;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let logger: TypeMoq.IMock<ILogger>;
    let historyProvider: TypeMoq.IMock<IHistoryProvider>;
    let activeHistory: TypeMoq.IMock<IHistory>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let textEditor: TypeMoq.IMock<TextEditor>;
    setup(() => {
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        logger = TypeMoq.Mock.ofType<ILogger>();
        historyProvider = TypeMoq.Mock.ofType<IHistoryProvider>();
        activeHistory = TypeMoq.Mock.ofType<IHistory>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        textEditor = TypeMoq.Mock.ofType<TextEditor>();

        // Setup our active history instance
        historyProvider.setup(h => h.active).returns(() => activeHistory.object);

        // Setup our active text editor
        documentManager.setup(dm => dm.activeTextEditor).returns(() => textEditor.object);

        codeWatcher = new CodeWatcher(commandManager.object, appShell.object, logger.object, historyProvider.object, documentManager.object);
    });

    test('Add a file with just a #%% mark to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = `#%%`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(2, 'Incorrect count of code lenses');
        expect(codeLenses[0].command.command).to.be.equal(Commands.RunCell, 'Run Cell code lens command incorrect');
        expect(codeLenses[0].range).to.be.deep.equal(new Range(0, 0, 0, 3), 'Run Cell code lens range incorrect');
        expect(codeLenses[1].command.command).to.be.equal(Commands.RunAllCells, 'Run All Cells code lens command incorrect');
        expect(codeLenses[1].range).to.be.deep.equal(new Range(0, 0, 0, 3), 'Run All Cells code lens range incorrect');

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file without a mark to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = `dummy`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(0, 'Incorrect count of code lenses');

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file with multiple marks to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`first line
second line
        
#%%
third line
        
#%%
fourth line`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(4, 'Incorrect count of code lenses');
        expect(codeLenses[0].command.command).to.be.equal(Commands.RunCell, 'Run Cell code lens command incorrect');
        expect(codeLenses[0].range).to.be.deep.equal(new Range(3, 0, 5, 8), 'Run Cell code lens range incorrect');
        expect(codeLenses[1].command.command).to.be.equal(Commands.RunAllCells, 'Run All Cells code lens command incorrect');
        expect(codeLenses[1].range).to.be.deep.equal(new Range(3, 0, 5, 8), 'Run All Cells code lens range incorrect');
        expect(codeLenses[2].command.command).to.be.equal(Commands.RunCell, 'Run Cell code lens command incorrect');
        expect(codeLenses[2].range).to.be.deep.equal(new Range(6, 0, 7, 11), 'Run Cell code lens range incorrect');
        expect(codeLenses[3].command.command).to.be.equal(Commands.RunAllCells, 'Run All Cells code lens command incorrect');
        expect(codeLenses[3].range).to.be.deep.equal(new Range(6, 0, 7, 11), 'Run All Cells code lens range incorrect');

        // Verify function calls
        document.verifyAll();
    });

    test('Test the RunCell command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = ''; // This test overrides getText, so we don't need to fill this in
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        // Specify our range and text here
        const testRange = new Range(0, 0, 10, 10);
        const testString = 'testing';
        document.setup(doc => doc.getText(testRange)).returns(() => testString).verifiable(TypeMoq.Times.once());

        codeWatcher.addFile(document.object);

        // Set up our expected call to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(0),
                                TypeMoq.It.is((ed: TextEditor) => {
                                    return textEditor.object === ed;
                                }))).verifiable(TypeMoq.Times.once());

        // Try our RunCell command
        await codeWatcher.runCell(testRange);

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunAllCells command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = 
`#%%
testing1
#%%
testing2`; // Command tests override getText, so just need the ranges here
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        // Specify our range and text here
        const testRange1 = new Range(0, 0, 1, 8);
        const testString1 = 'testing1';
        document.setup(doc => doc.getText(testRange1)).returns(() => testString1).verifiable(TypeMoq.Times.once());
        const testRange2 = new Range(2, 0, 3, 8);
        const testString2 = 'testing2';
        document.setup(doc => doc.getText(testRange2)).returns(() => testString2).verifiable(TypeMoq.Times.once());

        codeWatcher.addFile(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString1),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(0)
                                )).verifiable(TypeMoq.Times.once());

        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString2),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(2)
                                )).verifiable(TypeMoq.Times.once());

        // Try our RunCell command
        await codeWatcher.runAllCells();

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCurrentCell command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = 
`#%%
testing1
#%%
testing2`; 
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());
        document.setup(d => d.getText(new Range(2, 0, 3, 8))).returns(() => 'testing2').verifiable(TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue('testing2'),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(2),
                                TypeMoq.It.is((ed: TextEditor) => {
                                    return textEditor.object === ed;
                                }))).verifiable(TypeMoq.Times.once());
        
        // For this test we need to set up a document selection point
        textEditor.setup(te => te.selection).returns(() => new Selection(2, 0, 2, 0));
        
        // Try our RunCell command with the first selection point
        await codeWatcher.runCurrentCell();

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCurrentCell command outside of a cell', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = 
`testing1
#%%
testing2`; 
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // We don't want to ever call add code here
        activeHistory.setup(h => h.addCode(TypeMoq.It.isAny(),
                                TypeMoq.It.isAny(),
                                TypeMoq.It.isAny(),
                                TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());
        
        // For this test we need to set up a document selection point
        textEditor.setup(te => te.selection).returns(() => new Selection(0, 0, 0, 0));
        
        // Try our RunCell command with the first selection point
        await codeWatcher.runCurrentCell();

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCellAndAdvance command with next cell', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = 
`#%%
testing1
#%%
testing2`; // Command tests override getText, so just need the ranges here
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());
        const testRange = new Range(0, 0, 1, 8);
        const testString = 'testing1';
        document.setup(d => d.getText(testRange)).returns(() => testString).verifiable(TypeMoq.Times.atLeastOnce());

        codeWatcher.addFile(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(0),
                                TypeMoq.It.is((ed: TextEditor) => {
                                    return textEditor.object === ed;
                                }))).verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        const selection = new Selection(0, 0, 0, 0);
        textEditor.setup(te => te.selection).returns(() => selection);
        
        //textEditor.setup(te => te.selection = TypeMoq.It.isAny()).verifiable(TypeMoq.Times.once());
        //textEditor.setup(te => te.selection = TypeMoq.It.isAnyObject<Selection>(Selection));
        // IANHU: Would be good to check that selection was set, but TypeMoq doesn't seem to like
        // both getting and setting an object property. isAnyObject is not valid for this class
        // and is or isAny overwrite the previous property getter if used. Will verify selection set
        // in functional test
        // https://github.com/florinn/typemoq/issues/107

        // To get around this, override the advanceToRange function called from within runCurrentCellAndAdvance
        // this will tell us if we are calling the correct range
        codeWatcher['advanceToRange'] = (targetRange: Range) => {
            expect(targetRange.start.line).is.equal(2, 'Incorrect range in run cell and advance');
            expect(targetRange.start.character).is.equal(0, 'Incorrect range in run cell and advance');
            expect(targetRange.end.line).is.equal(3, 'Incorrect range in run cell and advance');
            expect(targetRange.end.character).is.equal(8, 'Incorrect range in run cell and advance');
        };

        await codeWatcher.runCurrentCellAndAdvance();

        // Verify function calls
        textEditor.verifyAll();
        activeHistory.verifyAll();
        document.verifyAll();
    });
});

// Helper function to create a document and get line count and lines
function createDocument(inputText: string, fileName: string, fileVersion: number,
        times: TypeMoq.Times): TypeMoq.IMock<TextDocument> {
    const document = TypeMoq.Mock.ofType<TextDocument>();

    // Split our string on newline chars
    const inputLines = inputText.split(/\r?\n/);

    // First set the metadata
    document.setup(d => d.fileName).returns(() => fileName).verifiable(times);
    document.setup(d => d.version).returns(() => fileVersion).verifiable(times);

    // Next add the lines in
    document.setup(d => d.lineCount).returns(() => inputLines.length).verifiable(times);

    inputLines.forEach((line, index) => {
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        const testRange = new Range(index, 0, index, line.length);
        textLine.setup(l => l.text).returns(() => line);
        textLine.setup(l => l.range).returns(() => testRange);
        document.setup(d => d.lineAt(TypeMoq.It.isValue(index))).returns(() => textLine.object).verifiable(TypeMoq.Times.atLeastOnce());
    });

    return document;
}
