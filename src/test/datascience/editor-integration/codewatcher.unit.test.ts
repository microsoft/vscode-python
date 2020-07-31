// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length no-trailing-whitespace no-multiline-string chai-vague-errors no-unused-expression
// Disable whitespace / multiline as we use that to pass in our fake file strings
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, CodeLens, Disposable, EventEmitter, Range, Selection, TextEditor, Uri } from 'vscode';

import { instance, mock, when } from 'ts-mockito';
import {
    ICommandManager,
    IDebugService,
    IDocumentManager,
    IVSCodeNotebook
} from '../../../client/common/application/types';
import { IConfigurationService } from '../../../client/common/types';
import { Commands, EditorContexts } from '../../../client/datascience/constants';
import { CodeLensFactory } from '../../../client/datascience/editor-integration/codeLensFactory';
import { DataScienceCodeLensProvider } from '../../../client/datascience/editor-integration/codelensprovider';
import { CodeWatcher } from '../../../client/datascience/editor-integration/codewatcher';
import { NotebookProvider } from '../../../client/datascience/interactive-common/notebookProvider';
import {
    ICodeWatcher,
    IDataScienceErrorHandler,
    IDataScienceFileSystem,
    IDebugLocationTracker,
    IInteractiveWindow,
    IInteractiveWindowProvider,
    INotebook
} from '../../../client/datascience/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ICodeExecutionHelper } from '../../../client/terminals/types';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
import { MockDocumentManager } from '../mockDocumentManager';
import { MockPythonSettings } from '../mockPythonSettings';
import { MockEditor } from '../mockTextEditor';
import { createDocument } from './helpers';

//tslint:disable:no-any

function initializeMockTextEditor(
    codeWatcher: CodeWatcher,
    documentManager: TypeMoq.IMock<IDocumentManager>,
    inputText: string
): MockEditor {
    const fileName = Uri.file('test.py').fsPath;
    const version = 1;
    const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);
    codeWatcher.setDocument(document.object);

    // For this test we need to set up a document selection point
    // TypeMoq does not play well with setting properties on editor
    const mockDocumentManager = new MockDocumentManager();
    const mockDocument = mockDocumentManager.addDocument(inputText, fileName);
    const mockTextEditor = new MockEditor(mockDocumentManager, mockDocument);
    documentManager.reset();
    documentManager.setup((dm) => dm.activeTextEditor).returns(() => mockTextEditor);
    mockTextEditor.selection = new Selection(0, 0, 0, 0);
    return mockTextEditor;
}

suite('DataScience Code Watcher Unit Tests', () => {
    let codeWatcher: CodeWatcher;
    let interactiveWindowProvider: TypeMoq.IMock<IInteractiveWindowProvider>;
    let activeInteractiveWindow: TypeMoq.IMock<IInteractiveWindow>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let textEditor: TypeMoq.IMock<TextEditor>;
    let fileSystem: TypeMoq.IMock<IDataScienceFileSystem>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let dataScienceErrorHandler: TypeMoq.IMock<IDataScienceErrorHandler>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let helper: TypeMoq.IMock<ICodeExecutionHelper>;
    let tokenSource: CancellationTokenSource;
    let debugService: TypeMoq.IMock<IDebugService>;
    let debugLocationTracker: TypeMoq.IMock<IDebugLocationTracker>;
    let vscodeNotebook: TypeMoq.IMock<IVSCodeNotebook>;
    const contexts: Map<string, boolean> = new Map<string, boolean>();
    const pythonSettings = new MockPythonSettings(undefined, new MockAutoSelectionService());
    const disposables: Disposable[] = [];

    setup(() => {
        tokenSource = new CancellationTokenSource();
        interactiveWindowProvider = TypeMoq.Mock.ofType<IInteractiveWindowProvider>();
        activeInteractiveWindow = createTypeMoq<IInteractiveWindow>('history');
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        textEditor = TypeMoq.Mock.ofType<TextEditor>();
        fileSystem = TypeMoq.Mock.ofType<IDataScienceFileSystem>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        debugLocationTracker = TypeMoq.Mock.ofType<IDebugLocationTracker>();
        helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        debugService = TypeMoq.Mock.ofType<IDebugService>();
        vscodeNotebook = TypeMoq.Mock.ofType<IVSCodeNotebook>();

        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            alwaysTrustNotebooks: true,
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
            enableScrollingForCellOutputs: true,
            errorBackgroundColor: '#FFFFFF',
            sendSelectionToInteractiveWindow: false,
            variableExplorerExclude: 'module;function;builtin_function_or_method',
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
            enableCellCodeLens: true,
            enablePlotViewer: true,
            runStartupCommands: '',
            debugJustMyCode: true,
            variableQueries: [],
            jupyterCommandLineArguments: [],
            widgetScriptSources: [],
            interactiveWindowMode: 'single'
        };
        debugService.setup((d) => d.activeDebugSession).returns(() => undefined);
        vscodeNotebook.setup((d) => d.activeNotebookEditor).returns(() => undefined);

        // Setup the service container to return code watchers
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        // Setup the file system
        fileSystem.setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => true);

        // Setup config service
        configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings);

        const dummyEvent = new EventEmitter<{ identity: Uri; notebook: INotebook }>();
        const notebookProvider = mock(NotebookProvider);
        when((notebookProvider as any).then).thenReturn(undefined);
        when(notebookProvider.onNotebookCreated).thenReturn(dummyEvent.event);

        const codeLensFactory = new CodeLensFactory(
            configService.object,
            instance(notebookProvider),
            fileSystem.object,
            documentManager.object
        );
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ICodeWatcher)))
            .returns(
                () =>
                    new CodeWatcher(
                        interactiveWindowProvider.object,
                        fileSystem.object,
                        configService.object,
                        documentManager.object,
                        helper.object,
                        dataScienceErrorHandler.object,
                        codeLensFactory
                    )
            );

        // Setup our error handler
        dataScienceErrorHandler = TypeMoq.Mock.ofType<IDataScienceErrorHandler>();

        // Setup our active history instance
        interactiveWindowProvider
            .setup((h) => h.getOrCreate(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(activeInteractiveWindow.object));

        // Setup our active text editor
        documentManager.setup((dm) => dm.activeTextEditor).returns(() => textEditor.object);

        commandManager
            .setup((c) => c.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((c, n, v) => {
                if (c === 'setContext') {
                    contexts.set(n, v);
                }
                return Promise.resolve();
            });

        codeWatcher = new CodeWatcher(
            interactiveWindowProvider.object,
            fileSystem.object,
            configService.object,
            documentManager.object,
            helper.object,
            dataScienceErrorHandler.object,
            codeLensFactory
        );
    });

    function createTypeMoq<T>(tag: string): TypeMoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: TypeMoq.IMock<T> = TypeMoq.Mock.ofType<T>();
        (result as any).tag = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    function verifyCodeLensesAtPosition(
        codeLenses: CodeLens[],
        startLensIndex: number,
        targetRange: Range,
        firstCell: boolean = false,
        markdownCell: boolean = false
    ) {
        if (codeLenses[startLensIndex].command) {
            expect(codeLenses[startLensIndex].command!.command).to.be.equal(
                Commands.RunCell,
                'Run Cell code lens command incorrect'
            );
        }
        expect(codeLenses[startLensIndex].range).to.be.deep.equal(targetRange, 'Run Cell code lens range incorrect');

        if (!firstCell) {
            if (codeLenses[startLensIndex + 1].command) {
                expect(codeLenses[startLensIndex + 1].command!.command).to.be.equal(
                    Commands.RunAllCellsAbove,
                    'Run Above code lens command incorrect'
                );
            }
            expect(codeLenses[startLensIndex + 1].range).to.be.deep.equal(
                targetRange,
                'Run Above code lens range incorrect'
            );
        }

        if (!markdownCell) {
            const indexAdd = 2;
            if (codeLenses[startLensIndex + indexAdd].command) {
                expect(codeLenses[startLensIndex + indexAdd].command!.command).to.be.equal(
                    Commands.DebugCell,
                    'Debug command incorrect'
                );
            }
            expect(codeLenses[startLensIndex + indexAdd].range).to.be.deep.equal(
                targetRange,
                'Debug code lens range incorrect'
            );

            // Debugger mode commands
            if (codeLenses[startLensIndex + indexAdd + 1].command) {
                expect(codeLenses[startLensIndex + indexAdd + 1].command!.command).to.be.equal(
                    Commands.DebugContinue,
                    'Debug command incorrect'
                );
            }
            expect(codeLenses[startLensIndex + indexAdd + 1].range).to.be.deep.equal(
                targetRange,
                'Debug code lens range incorrect'
            );
            if (codeLenses[startLensIndex + indexAdd + 2].command) {
                expect(codeLenses[startLensIndex + indexAdd + 2].command!.command).to.be.equal(
                    Commands.DebugStop,
                    'Debug command incorrect'
                );
            }
            expect(codeLenses[startLensIndex + indexAdd + 2].range).to.be.deep.equal(
                targetRange,
                'Debug code lens range incorrect'
            );
            if (codeLenses[startLensIndex + indexAdd + 3].command) {
                expect(codeLenses[startLensIndex + indexAdd + 3].command!.command).to.be.equal(
                    Commands.DebugStepOver,
                    'Debug command incorrect'
                );
            }
            expect(codeLenses[startLensIndex + indexAdd + 3].range).to.be.deep.equal(
                targetRange,
                'Debug code lens range incorrect'
            );
        }
    }

    test('Add a file with just a #%% mark to a code watcher', () => {
        const fileName = Uri.file('test.py').fsPath;
        const version = 1;
        const inputText = `#%%`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.uri?.fsPath).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(6, 'Incorrect count of code lenses');
        verifyCodeLensesAtPosition(codeLenses, 0, new Range(0, 0, 0, 3), true);

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file without a mark to a code watcher', () => {
        const fileName = Uri.file('test.py').fsPath;
        const version = 1;
        const inputText = `dummy`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.uri?.fsPath).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(0, 'Incorrect count of code lenses');

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file with multiple marks to a code watcher', () => {
        const fileName = Uri.file('test.py').fsPath;
        const version = 1;
        const inputText = `first line
second line

#%%
third line

#%%
fourth line`;
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.uri?.fsPath).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(12, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 6, new Range(6, 0, 7, 11));

        // Verify function calls
        document.verifyAll();
    });

    test('Add a file with custom marks to a code watcher', () => {
        const fileName = Uri.file('test.py').fsPath;
        const version = 1;
        const inputText = `first line
second line

# <foobar>
third line

# <baz>
fourth line

# <mymarkdown>
# fifth line`;
        pythonSettings.datascience.codeRegularExpression = '(#\\s*\\<foobar\\>|#\\s*\\<baz\\>)';
        pythonSettings.datascience.markdownRegularExpression = '(#\\s*\\<markdowncell\\>|#\\s*\\<mymarkdown\\>)';

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.uri?.fsPath).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(14, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 6, new Range(6, 0, 8, 0));
        verifyCodeLensesAtPosition(codeLenses, 12, new Range(9, 0, 10, 12), false, true);

        // Verify function calls
        document.verifyAll();
    });

    test('Make sure invalid regex from a user still work', () => {
        const fileName = Uri.file('test.py').fsPath;
        const version = 1;
        const inputText = `first line
second line

# <codecell>
third line

# <codecell>
fourth line

# <mymarkdown>
# fifth line`;
        pythonSettings.datascience.codeRegularExpression = '# * code cell)';
        pythonSettings.datascience.markdownRegularExpression = '(#\\s*\\<markdowncell\\>|#\\s*\\<mymarkdown\\>)';

        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Verify meta data
        expect(codeWatcher.uri?.fsPath).to.be.equal(fileName, 'File name of CodeWatcher does not match');
        expect(codeWatcher.getVersion()).to.be.equal(version, 'File version of CodeWatcher does not match');

        // Verify code lenses
        const codeLenses = codeWatcher.getCodeLenses();
        expect(codeLenses.length).to.be.equal(14, 'Incorrect count of code lenses');

        verifyCodeLensesAtPosition(codeLenses, 0, new Range(3, 0, 5, 0), true);
        verifyCodeLensesAtPosition(codeLenses, 6, new Range(6, 0, 8, 0));
        verifyCodeLensesAtPosition(codeLenses, 12, new Range(9, 0, 10, 12), false, true);

        // Verify function calls
        document.verifyAll();
    });

    test('Test the RunCell command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const testString = '#%%\ntesting';
        const document = createDocument(testString, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);
        const testRange = new Range(0, 0, 1, 7);

        codeWatcher.setDocument(document.object);

        // Set up our expected call to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(testString),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.is((ed: TextEditor) => {
                        return textEditor.object === ed;
                    }),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        // Try our RunCell command
        await codeWatcher.runCell(testRange);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunFileInteractive command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce());

        document
            .setup((doc) => doc.getText())
            .returns(() => inputText)
            .verifiable(TypeMoq.Times.exactly(1));

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        // RunFileInteractive should run the entire file in one block, not cell by cell like RunAllCells
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(inputText),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        await codeWatcher.runFileInteractive();

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunAllCells command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `testing0
#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('testing0\n#%%\ntesting1'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('#%%\ntesting2'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(3),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        await codeWatcher.runAllCells();

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCurrentCell command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('#%%\ntesting2'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(2),
                    TypeMoq.It.is((ed: TextEditor) => {
                        return textEditor.object === ed;
                    }),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        textEditor.setup((te) => te.selection).returns(() => new Selection(2, 0, 2, 0));

        await codeWatcher.runCurrentCell();

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCellAndAllBelow command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText1 = `#%%
testing2`;

        const targetText2 = `#%%
testing3`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText1),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(2),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText2),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(4),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        await codeWatcher.runCellAndAllBelow(2, 0);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunAllCellsAbove command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `testing0
#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText1 = `testing0
#%%
testing1`;

        const targetText2 = `#%%
testing2`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText1),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(1),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText2),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(3),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        await codeWatcher.runAllCellsAbove(4, 0);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunToLine command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText = `#%%
testing1`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        await codeWatcher.runToLine(2);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunToLine command with nothing on the lines', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `

print('testing')`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // If adding empty lines nothing should be added and history should not be started
        interactiveWindowProvider
            .setup((h) => h.getOrCreate(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(activeInteractiveWindow.object))
            .verifiable(TypeMoq.Times.never());
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isAnyNumber(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.never());

        await codeWatcher.runToLine(2);

        // Verify function calls
        interactiveWindowProvider.verifyAll();
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunFromLine command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText = `#%%
testing2
#%%
testing3`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(2),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        // Try our RunCell command with the first selection point
        await codeWatcher.runFromLine(2);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunSelection command', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);
        helper
            .setup((h) =>
                h.getSelectedTextToExecute(
                    TypeMoq.It.is((ed: TextEditor) => {
                        return textEditor.object === ed;
                    })
                )
            )
            .returns(() => Promise.resolve('testing2'));
        helper.setup((h) => h.normalizeLines(TypeMoq.It.isAny())).returns(() => Promise.resolve('testing2'));

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('testing2'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(3),
                    TypeMoq.It.is((ed: TextEditor) => {
                        return textEditor.object === ed;
                    }),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        textEditor.setup((te) => te.document).returns(() => document.object);
        textEditor.setup((te) => te.selection).returns(() => new Selection(3, 0, 3, 0));

        // Try our RunCell command with the first selection point
        await codeWatcher.runSelectionOrLine(textEditor.object);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunCellAndAdvance command with next cell', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2`;
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('#%%\ntesting1'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.is((ed: TextEditor) => {
                        return textEditor.object === ed;
                    }),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        // For this test we need to set up a document selection point
        const selection = new Selection(0, 0, 0, 0);
        textEditor.setup((te) => te.selection).returns(() => selection);

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
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('CodeLens returned after settings changed is different', () => {
        // Create our document
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = '#%% foobar';
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce());
        document.setup((doc) => doc.getText()).returns(() => inputText);
        documentManager.setup((d) => d.textDocuments).returns(() => [document.object]);
        const codeLensProvider = new DataScienceCodeLensProvider(
            serviceContainer.object,
            debugLocationTracker.object,
            documentManager.object,
            configService.object,
            commandManager.object,
            disposables,
            debugService.object,
            fileSystem.object,
            vscodeNotebook.object
        );

        let result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        let codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(3, 'Code lens wrong length - initial');

        expect(contexts.get(EditorContexts.HasCodeCells)).to.be.equal(true, 'Code cells context not set');

        // Change settings
        pythonSettings.datascience.codeRegularExpression = '#%%%.*dude';
        pythonSettings.fireChangeEvent();
        result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(0, 'Code lens wrong length');

        expect(contexts.get(EditorContexts.HasCodeCells)).to.be.equal(false, 'Code cells context not set');

        // Change settings to empty
        pythonSettings.datascience.codeRegularExpression = '';
        pythonSettings.fireChangeEvent();
        result = codeLensProvider.provideCodeLenses(document.object, tokenSource.token);
        expect(result, 'result not okay').to.be.ok;
        codeLens = result as CodeLens[];
        expect(codeLens.length).to.equal(3, 'Code lens wrong length - final');
    });

    test('Test the RunAllCellsAbove command with an error', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2
#%%
testing3`;
        const targetText1 = `#%%
testing1`;

        const targetText2 = `#%%
testing2`;

        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText1),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());

        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue(targetText2),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(2),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.never());

        await codeWatcher.runAllCellsAbove(4, 0);

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test the RunAllCells command with an error', async () => {
        const fileName = Uri.file('test.py');
        const version = 1;
        const inputText = `#%%
testing1
#%%
testing2`; // Command tests override getText, so just need the ranges here
        const document = createDocument(inputText, fileName.fsPath, version, TypeMoq.Times.atLeastOnce(), true);

        codeWatcher.setDocument(document.object);

        // Set up our expected calls to add code
        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('#%%\ntesting1'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(0),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());

        activeInteractiveWindow
            .setup((h) =>
                h.addCode(
                    TypeMoq.It.isValue('#%%\ntesting2'),
                    TypeMoq.It.isValue(fileName),
                    TypeMoq.It.isValue(2),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.never());

        await codeWatcher.runAllCells();

        // Verify function calls
        activeInteractiveWindow.verifyAll();
        document.verifyAll();
    });

    test('Test insert cell below position', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(0, 4, 0, 4);

        codeWatcher.insertCellBelowPosition();

        expect(mockTextEditor.document.getText()).to.equal(`testing0
# %%

#%%
testing1
#%%
testing2`);
        expect(mockTextEditor.selection.start.line).to.equal(2);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(2);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell below position at end', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
#%%
testing2`
        );

        // end selection at bottom of document
        mockTextEditor.selection = new Selection(1, 4, 5, 8);

        codeWatcher.insertCellBelowPosition();

        expect(mockTextEditor.document.getText()).to.equal(`testing0
#%%
testing1
#%%
testing2
# %%
`);
        expect(mockTextEditor.selection.start.line).to.equal(7);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(7);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell below', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(2, 4, 2, 4);

        codeWatcher.insertCellBelow();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing0
#%%
testing1
testing1a
# %%

#%%
testing2`
        );
        expect(mockTextEditor.selection.start.line).to.equal(5);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(5);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell below but above any cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(0, 4, 0, 4);

        codeWatcher.insertCellBelow();

        expect(mockTextEditor.document.getText()).to.equal(`testing0
# %%

#%%
testing1
#%%
testing2`);
        expect(mockTextEditor.selection.start.line).to.equal(2);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(2);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell below selection range', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        // range crossing multiple cells.Insert below bottom of range.
        mockTextEditor.selection = new Selection(0, 4, 2, 4);

        codeWatcher.insertCellBelow();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing0
#%%
testing1
testing1a
# %%

#%%
testing2`
        );
        expect(mockTextEditor.selection.start.line).to.equal(5);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(5);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell above first cell of range', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        // above the first cell of the range
        mockTextEditor.selection = new Selection(3, 4, 5, 4);

        codeWatcher.insertCellAbove();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing0
# %%

#%%
testing1
testing1a
#%%
testing2`
        );
        expect(mockTextEditor.selection.start.line).to.equal(2);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(2);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Test insert cell above and above cells', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(0, 3, 0, 4);

        codeWatcher.insertCellAbove();

        expect(mockTextEditor.document.getText()).to.equal(
            `# %%

testing0
#%%
testing1
testing1a
#%%
testing2`
        );
        expect(mockTextEditor.selection.start.line).to.equal(1);
        expect(mockTextEditor.selection.start.character).to.equal(0);
        expect(mockTextEditor.selection.end.line).to.equal(1);
        expect(mockTextEditor.selection.end.character).to.equal(0);
    });

    test('Delete single cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(3, 4, 3, 4);

        codeWatcher.deleteCells();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing0
#%%
testing2`
        );
    });

    test('Delete multiple cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(3, 4, 5, 4);

        codeWatcher.deleteCells();

        expect(mockTextEditor.document.getText()).to.equal(`testing0`);
    });

    test('Delete cell no cells in selection', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(0, 1, 0, 4);

        codeWatcher.deleteCells();

        expect(mockTextEditor.document.getText()).to.equal(`testing0
#%%
testing1
testing1a
#%%
testing2`);
    });

    test('Select cell single', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(2, 1, 2, 1);

        codeWatcher.selectCell();

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(3);
        expect(mockTextEditor.selection.active.character).to.equal(9);
    });

    test('Select cell multiple', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(2, 1, 4, 1);

        codeWatcher.selectCell();

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(5);
        expect(mockTextEditor.selection.active.character).to.equal(8);
    });

    test('Select cell multiple reversed', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(4, 1, 2, 1);

        codeWatcher.selectCell();

        expect(mockTextEditor.selection.active.line).to.equal(1);
        expect(mockTextEditor.selection.active.character).to.equal(0);
        expect(mockTextEditor.selection.anchor.line).to.equal(5);
        expect(mockTextEditor.selection.anchor.character).to.equal(8);
    });

    test('Select cell above cells unchanged', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(0, 1, 0, 4);

        codeWatcher.selectCell();

        expect(mockTextEditor.selection.start.line).to.equal(0);
        expect(mockTextEditor.selection.start.character).to.equal(1);
        expect(mockTextEditor.selection.end.line).to.equal(0);
        expect(mockTextEditor.selection.end.character).to.equal(4);
    });

    test('Select cell contents', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(3, 4, 3, 4);

        codeWatcher.selectCellContents();

        expect(mockTextEditor.selections.length).to.equal(1);

        const selection = mockTextEditor.selections[0];
        expect(selection.anchor.line).to.equal(2);
        expect(selection.anchor.character).to.equal(0);
        expect(selection.active.line).to.equal(3);
        expect(selection.active.character).to.equal(9);
    });

    test('Select cell contents multi cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(3, 4, 5, 4);

        codeWatcher.selectCellContents();

        expect(mockTextEditor.selections.length).to.equal(2);

        let selection: Selection;
        selection = mockTextEditor.selections[0];
        expect(selection.anchor.line).to.equal(2);
        expect(selection.anchor.character).to.equal(0);
        expect(selection.active.line).to.equal(3);
        expect(selection.active.character).to.equal(9);

        selection = mockTextEditor.selections[1];
        expect(selection.anchor.line).to.equal(5);
        expect(selection.anchor.character).to.equal(0);
        expect(selection.active.line).to.equal(5);
        expect(selection.active.character).to.equal(8);
    });

    test('Select cell contents multi cell reversed', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing0
#%%
testing1
testing1a
#%%
testing2`
        );

        mockTextEditor.selection = new Selection(5, 4, 3, 4);

        codeWatcher.selectCellContents();

        expect(mockTextEditor.selections.length).to.equal(2);

        let selection: Selection;
        selection = mockTextEditor.selections[0];
        expect(selection.active.line).to.equal(2);
        expect(selection.active.character).to.equal(0);
        expect(selection.anchor.line).to.equal(3);
        expect(selection.anchor.character).to.equal(9);

        selection = mockTextEditor.selections[1];
        expect(selection.active.line).to.equal(5);
        expect(selection.active.character).to.equal(0);
        expect(selection.anchor.line).to.equal(5);
        expect(selection.anchor.character).to.equal(8);
    });

    test('Extend selection by cell above initial select', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 5, 2);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(6);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(4);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above initial range in cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 6, 4);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(6);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(4);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above initial range in cell opposite direction', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 4, 5, 2);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(6);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(4);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above initial range below cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 8, 2);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell above initial range above cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(8, 2, 5, 2);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(8);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(4);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above expand above', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 10, 4, 0);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(6);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(1);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above contract below', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(1, 0, 6, 10);

        codeWatcher.extendSelectionByCellAbove();

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(3);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below initial select', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 5, 2);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below initial range in cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 6, 4);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below initial range in cell opposite direction', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 4, 5, 2);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below initial range below cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(3, 2, 6, 2);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below initial range above cell', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 2, 3, 2);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below expand below', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 10, 4, 0);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(8);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Extend selection by cell below contract above', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(6, 10, 1, 0);

        codeWatcher.extendSelectionByCellBelow();

        expect(mockTextEditor.selection.anchor.line).to.equal(6);
        expect(mockTextEditor.selection.anchor.character).to.equal(10);
        expect(mockTextEditor.selection.active.line).to.equal(4);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Extend selection by cell above and below', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 2, 6, 2);

        codeWatcher.extendSelectionByCellAbove(); // select full cell
        codeWatcher.extendSelectionByCellAbove(); // select cell above
        codeWatcher.extendSelectionByCellAbove(); // top cell no change
        codeWatcher.extendSelectionByCellAbove(); // top cell no change
        codeWatcher.extendSelectionByCellBelow(); // contract by cell
        codeWatcher.extendSelectionByCellBelow(); // expand by cell below
        codeWatcher.extendSelectionByCellBelow(); // last cell no change
        codeWatcher.extendSelectionByCellAbove(); // Original cell

        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(6);
        expect(mockTextEditor.selection.active.character).to.equal(10);
    });

    test('Move cells up', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 5, 5, 5);

        await codeWatcher.moveCellsUp();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L5
testing_L6
# %%
testing_L2
testing_L3
# %%
testing_L8`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(2);
        expect(mockTextEditor.selection.anchor.character).to.equal(5);
        expect(mockTextEditor.selection.active.line).to.equal(2);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Move cells up multiple cells', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(8, 8, 5, 5);

        await codeWatcher.moveCellsUp();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L5
testing_L6
# %%
testing_L8
# %%
testing_L2
testing_L3`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(5);
        expect(mockTextEditor.selection.anchor.character).to.equal(8);
        expect(mockTextEditor.selection.active.line).to.equal(2);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Move cells up first cell no change', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(1, 2, 5, 5);

        await codeWatcher.moveCellsUp();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(2);
        expect(mockTextEditor.selection.active.line).to.equal(5);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Move cells down', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 5, 5, 5);

        await codeWatcher.moveCellsDown();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L8
# %%
testing_L5
testing_L6`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(7);
        expect(mockTextEditor.selection.anchor.character).to.equal(5);
        expect(mockTextEditor.selection.active.line).to.equal(7);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Move cells down multiple cells', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(2, 2, 5, 5);

        await codeWatcher.moveCellsDown();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L8
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(4);
        expect(mockTextEditor.selection.anchor.character).to.equal(2);
        expect(mockTextEditor.selection.active.line).to.equal(7);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Move cells down last cell no change', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );

        mockTextEditor.selection = new Selection(5, 5, 8, 5);

        await codeWatcher.moveCellsDown();

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
testing_L2
testing_L3
# %%
testing_L5
testing_L6
# %%
testing_L8`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(5);
        expect(mockTextEditor.selection.anchor.character).to.equal(5);
        expect(mockTextEditor.selection.active.line).to.equal(8);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Change cell to markdown', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %%
testing_L2
testing_L3
# %% extra
# # testing_L5
testing_L6

`
        );

        mockTextEditor.selection = new Selection(1, 2, 5, 5);

        codeWatcher.changeCellToMarkdown();

        // NOTE: When running the function in real environment there
        // are comment lines added in addition to the [markdown] definition.
        // It is unclear with TypeMoq how to test this particular behavior because
        // the external `commands.executeCommmands` is being proxied along with
        // all subsequent calls. Essentially, I must rely on those functions
        // being unit tested.
        /*
            actual expected = `testing_L0
# %%
testing_L2
testing_L3
# %% [markdown] extra
# # testing_L5
# testing_L6

`
        */

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %% [markdown]
testing_L2
testing_L3
# %% [markdown] extra
# # testing_L5
testing_L6

`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(5);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(8);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Change cell to markdown no change', async () => {
        const text = `testing_L0
# %% [markdown]
testing_L2
testing_L3
# %% [markdown] extra
# # testing_L5
testing_L6

`;
        const mockTextEditor = initializeMockTextEditor(codeWatcher, documentManager, text);

        mockTextEditor.selection = new Selection(1, 2, 5, 5);

        codeWatcher.changeCellToMarkdown();

        expect(mockTextEditor.document.getText()).to.equal(text);

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(2);
        expect(mockTextEditor.selection.active.line).to.equal(5);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });

    test('Change cell to code', async () => {
        const mockTextEditor = initializeMockTextEditor(
            codeWatcher,
            documentManager,
            `testing_L0
# %% [markdown]
# testing_L2
# testing_L3
# %% [markdown] extra
# # testing_L5
# testing_L6

`
        );

        mockTextEditor.selection = new Selection(1, 2, 5, 5);

        codeWatcher.changeCellToCode();

        // NOTE: When running the function in real environment there
        // are comment lines added in addition to the [markdown] definition.
        // It is unclear with TypeMoq how to test this particular behavior because
        // the external `commands.executeCommmands` is being proxied along with
        // all subsequent calls. Essentially, I must rely on those functions
        // being unit tested.
        /*
            actual expected = `testing_L0
# %%
testing_L2
testing_L3
# %% [markdown] extra
# # testing_L5
# testing_L6

`
        */

        expect(mockTextEditor.document.getText()).to.equal(
            `testing_L0
# %%
# testing_L2
# testing_L3
# %% extra
# # testing_L5
# testing_L6

`
        );
        expect(mockTextEditor.selection.anchor.line).to.equal(5);
        expect(mockTextEditor.selection.anchor.character).to.equal(0);
        expect(mockTextEditor.selection.active.line).to.equal(8);
        expect(mockTextEditor.selection.active.character).to.equal(0);
    });

    test('Change cell to code no change', async () => {
        const text = `testing_L0
# %%
# testing_L2
# testing_L3
# %% extra
# # testing_L5
# testing_L6

`;
        const mockTextEditor = initializeMockTextEditor(codeWatcher, documentManager, text);

        mockTextEditor.selection = new Selection(1, 2, 5, 5);

        codeWatcher.changeCellToCode();

        expect(mockTextEditor.document.getText()).to.equal(text);

        expect(mockTextEditor.selection.anchor.line).to.equal(1);
        expect(mockTextEditor.selection.anchor.character).to.equal(2);
        expect(mockTextEditor.selection.active.line).to.equal(5);
        expect(mockTextEditor.selection.active.character).to.equal(5);
    });
});
