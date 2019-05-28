// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length no-trailing-whitespace no-multiline-string chai-vague-errors no-unused-expression
// Disable whitespace / multiline as we use that to pass in our fake file strings
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, CodeLens, Range, Selection, TextEditor } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../../client/common/application/types';
import { PythonSettings } from '../../../client/common/configSettings';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, ILogger } from '../../../client/common/types';
import { Commands } from '../../../client/datascience/constants';
import { DataScienceCodeLensProvider } from '../../../client/datascience/editor-integration/codelensprovider';
import { CodeWatcher } from '../../../client/datascience/editor-integration/codewatcher';
import { ICodeWatcher, IHistory, IHistoryProvider } from '../../../client/datascience/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
import { createDocument } from './helpers';

//tslint:disable:no-any

suite('DataScience Code Watcher Unit Tests', () => {
    let codeWatcher: CodeWatcher;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let logger: TypeMoq.IMock<ILogger>;
    let historyProvider: TypeMoq.IMock<IHistoryProvider>;
    let activeHistory: TypeMoq.IMock<IHistory>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let textEditor: TypeMoq.IMock<TextEditor>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let serviceContainer : TypeMoq.IMock<IServiceContainer>;
    let tokenSource : CancellationTokenSource;
    const pythonSettings = new class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    }(undefined, new MockAutoSelectionService());

    setup(() => {
        tokenSource = new CancellationTokenSource();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        logger = TypeMoq.Mock.ofType<ILogger>();
        historyProvider = TypeMoq.Mock.ofType<IHistoryProvider>();
        activeHistory = createTypeMoq<IHistory>('history');
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        textEditor = TypeMoq.Mock.ofType<TextEditor>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();

        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 20000,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            maxOutputSize: 400,
            errorBackgroundColor: '#FFFFFF',
            sendSelectionToInteractiveWindow: false,
            showJupyterVariableExplorer: true,
            variableExplorerExclude: 'module;builtin_function_or_method',
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
            enableCellCodeLens: true
        };

        // Setup the service container to return code watchers
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICodeWatcher))).returns(() => new CodeWatcher(appShell.object, logger.object, historyProvider.object, fileSystem.object, configService.object, documentManager.object));

        // Setup our active history instance
        historyProvider.setup(h => h.getOrCreateActive()).returns(() => Promise.resolve(activeHistory.object));

        // Setup our active text editor
        documentManager.setup(dm => dm.activeTextEditor).returns(() => textEditor.object);

        // Setup the file system
        fileSystem.setup(f => f.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);

        // Setup config service
        configService.setup(c => c.getSettings()).returns(() => pythonSettings);

        codeWatcher = new CodeWatcher(appShell.object, logger.object, historyProvider.object, fileSystem.object, configService.object, documentManager.object);
    });

    function createTypeMoq<T>(tag: string): TypeMoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: TypeMoq.IMock<T> = TypeMoq.Mock.ofType<T>();
        (result as any).tag = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    function verifyCodeLensesAtPosition(codeLenses: CodeLens[], startLensIndex: number, targetRange: Range, firstCell: boolean = false) {
        if (codeLenses[startLensIndex].command) {
            expect(codeLenses[startLensIndex].command!.command).to.be.equal(Commands.RunCell, 'Run Cell code lens command incorrect');
        }
        expect(codeLenses[startLensIndex].range).to.be.deep.equal(targetRange, 'Run Cell code lens range incorrect');

        if (!firstCell) {
            if (codeLenses[startLensIndex + 1].command) {
                expect(codeLenses[startLensIndex + 1].command!.command).to.be.equal(Commands.RunAllCellsAbove, 'Run Above code lens command incorrect');
            }
            expect(codeLenses[startLensIndex + 1].range).to.be.deep.equal(targetRange, 'Run Above code lens range incorrect');
        }

        const indexAdd = firstCell ? 1 : 2;
        if (codeLenses[startLensIndex + indexAdd].command) {
            expect(codeLenses[startLensIndex + indexAdd].command!.command).to.be.equal(Commands.RunCellAndAllBelow, 'Run Below code lens command incorrect');
        }
        expect(codeLenses[startLensIndex + indexAdd].range).to.be.deep.equal(targetRange, 'Run Below code lens range incorrect');
    }

    test('Add a file with just a #%% mark to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = `#%%`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(2, 'Incorrect count of code lenses');
        verifyCodeLensesAtPosition(codeLenses, 0, new Range(0, 0, 0, 3), true);

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file without a mark to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText = `dummy`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.setDocument(document.object);

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

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(5, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 2, new Range(6, 0, 7, 11));

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file with custom marks to a code watcher', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`first line
second line

# <foobar>
third line

# <baz>
fourth line

# <mymarkdown>
# fifth line`;
        pythonSettings.datascience.codeRegularExpression = '(#\\s*\\<foobar\\>|#\\s*\\<baz\\>)';
        pythonSettings.datascience.markdownRegularExpression = '(#\\s*\\<markdowncell\\>|#\\s*\\<mymarkdown\\>)';

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(8, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 2, new Range(6, 0, 8, 0));
        verifyCodeLensesAtPosition(codeLenses, 5, new Range(9, 0, 10, 12));

        // Verify function calls
        document.verifyAll();
    });

    test('Make sure invalid regex from a user still work', () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`first line
second line

# <codecell>
third line

# <codecell>
fourth line

# <mymarkdown>
# fifth line`;
        pythonSettings.datascience.codeRegularExpression = '# * code cell)';
        pythonSettings.datascience.markdownRegularExpression = '(#\\s*\\<markdowncell\\>|#\\s*\\<mymarkdown\\>)';

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.getFileName()).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(8, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 2, new Range(6, 0, 8, 0));
        verifyCodeLensesAtPosition(codeLenses, 5, new Range(9, 0, 10, 12));

        // Verify function calls
        document.verifyAll();
    });

    test('Test the RunCell command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const testString = '#%%\ntesting';
        const document = createDocument(testString, fileName, version, TypeMoq.Times.atLeastOnce(), true);
        const testRange = new Range(0, 0, 1, 7);

        codeWatcher.setDocument(document.object);

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

    test('Test the RunFileInteractive command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2`; // Command tests override getText, so just need the ranges here
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        // RunFileInteractive should run the entire file in one block, not cell by cell like RunAllCells
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(inputText),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(0),
                                TypeMoq.It.isAny()
                                )).verifiable(TypeMoq.Times.once());

        await codeWatcher.runFileInteractive();

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

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString1),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(0),
                                TypeMoq.It.isAny()
                                )).verifiable(TypeMoq.Times.once());

        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(testString2),
                                TypeMoq.It.isValue('test.py'),
                                TypeMoq.It.isValue(2),
                                TypeMoq.It.isAny()
                                )).verifiable(TypeMoq.Times.once());

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

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue('testing2'),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(2),
                                TypeMoq.It.is((ed: TextEditor) => {
                                    return textEditor.object === ed;
                                }))).verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        textEditor.setup(te => te.selection).returns(() => new Selection(2, 0, 2, 0));

        await codeWatcher.runCurrentCell();

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCellAndAllBelow command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText1 =
`#%%
testing2`;

        const targetText2 =
`#%%
testing3`;

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText1),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(2))).verifiable(TypeMoq.Times.once());

        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText2),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(4))).verifiable(TypeMoq.Times.once());

        await codeWatcher.runCellAndAllBelow(2, 0);

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunAllCellsAbove command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText1 =
`#%%
testing1`;

        const targetText2 =
`#%%
testing2`;

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText1),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(0))).verifiable(TypeMoq.Times.once());

        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText2),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(2))).verifiable(TypeMoq.Times.once());

        await codeWatcher.runAllCellsAbove(4, 0);

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunToLine command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText =
`#%%
testing1`;

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(0))).verifiable(TypeMoq.Times.once());

        await codeWatcher.runToLine(2);

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunToLine command with nothing on the lines', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`

print('testing')`;

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // If adding empty lines nothing should be added and history should not be started
        historyProvider.setup(h => h.getOrCreateActive()).returns(() => Promise.resolve(activeHistory.object)).verifiable(TypeMoq.Times.never());
        activeHistory.setup(h => h.addCode(TypeMoq.It.isAny(),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isAnyNumber())).verifiable(TypeMoq.Times.never());

        await codeWatcher.runToLine(2);

        // Verify function calls
        historyProvider.verifyAll();
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunFromLine command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText =
`#%%
testing2
#%%
testing3`;

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue(targetText),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(2))).verifiable(TypeMoq.Times.once());

        // Try our RunCell command with the first selection point
        await codeWatcher.runFromLine(2);

        // Verify function calls
        activeHistory.verifyAll();
        document.verifyAll();
    });

    test('Test the RunSelection command', async () => {
        const fileName = 'test.py';
        const version = 1;
        const inputText =
`#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeHistory.setup(h => h.addCode(TypeMoq.It.isValue('testing2'),
                                TypeMoq.It.isValue(fileName),
                                TypeMoq.It.isValue(3),
                                TypeMoq.It.is((ed: TextEditor) => {
                                    return textEditor.object === ed;
                                }))).verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        textEditor.setup(te => te.document).returns(() => document.object);
        textEditor.setup(te => te.selection).returns(() => new Selection(3, 0, 3, 0));

        // Try our RunCell command with the first selection point
        await codeWatcher.runSelectionOrLine(textEditor.object);

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

        codeWatcher.setDocument(document.object);

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

        codeWatcher.setDocument(document.object);

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
        // Would be good to check that selection was set, but TypeMoq doesn't seem to like
        // both getting and setting an object property. isAnyObject is not valid for this class
        // and is or isAny overwrite the previous property getter if used. Will verify selection set
        // in functional test
        // https://github.com/florinn/typemoq/issues/107

        // To get around this, override the advanceToRange function called from within runCurrentCellAndAdvance
        // this will tell us if we are calling the correct range
        (codeWatcher as any).advanceToRange = (targetRange: Range) => {
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

    test('CodeLens returned after settings changed is different', () => {
        // Create our document
        const fileName = 'test.py';
        const version = 1;
        const inputText = '#%% foobar';
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());
        documentManager.setup(d => d.textDocuments).returns(() => [document.object]);
        const codeLensProvider = new DataScienceCodeLensProvider(serviceContainer.object, documentManager.object, configService.object);

        let result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        let codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(2, 'Code lens wrong length');

        // Change settings
        pythonSettings.datascience.codeRegularExpression = '#%%%.*dude';
        result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(0, 'Code lens wrong length');

        // Change settings to empty
        pythonSettings.datascience.codeRegularExpression = '';
        result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(2, 'Code lens wrong length');
    });
});
