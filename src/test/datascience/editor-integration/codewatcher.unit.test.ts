// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { TextDocument, TextLine, Range } from 'vscode';
import { CodeWatcher } from '../../../client/datascience/editor-integration/codewatcher';
import { ICommandManager, IApplicationShell } from '../../../client/common/application/types';
import { ILogger } from '../../../client/common/types';
import { IHistoryProvider } from '../../../client/datascience/types';
import { Commands } from '../../../client/datascience/constants';

suite('DataScience Code Watcher Unit Tests', () => {
    let codeWatcher: CodeWatcher;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let logger: TypeMoq.IMock<ILogger>;
    let historyProvider: TypeMoq.IMock<IHistoryProvider>;
    setup(() => {
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        logger = TypeMoq.Mock.ofType<ILogger>();
        historyProvider = TypeMoq.Mock.ofType<IHistoryProvider>();


        codeWatcher = new CodeWatcher(commandManager.object, appShell.object, logger.object, historyProvider.object);
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
        expect(codeLenses[0].range).to.be.deep.equal(new Range(0,0,0,3), 'Run Cell code lens range incorrect');
        expect(codeLenses[1].command.command).to.be.equal(Commands.RunAllCells, 'Run All Cells code lens command incorrect');
        expect(codeLenses[1].range).to.be.deep.equal(new Range(0,0,0,3), 'Run All Cells code lens range incorrect');

        // Verify function calls
        document.verifyAll();
    });
});

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
        const lastLine = TypeMoq.Mock.ofType<TextLine>();
        const testRange = new Range(index,0,index,line.length);
        lastLine.setup(l => l.text).returns(() => '#%%').verifiable(times);
        lastLine.setup(l => l.range).returns(() => testRange).verifiable(times);
        document.setup(d => d.lineAt(TypeMoq.It.isValue(index))).returns(() => lastLine.object).verifiable(TypeMoq.Times.atLeastOnce());
    });

    return document;
}