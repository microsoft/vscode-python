// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { assert, expect } from 'chai';
import { ChildProcess } from 'child_process';
import { EOL } from 'os';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as sinon from 'sinon';
import { Writable } from 'stream';
import * as TypeMoq from 'typemoq';
import { Range, TextDocument, TextEditor, TextLine, Uri, WorkspaceEdit } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { Commands, EXTENSION_ROOT_DIR, STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { ProcessService } from '../../client/common/process/proc';
import {
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService,
    Output
} from '../../client/common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IEditorUtils,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
    ISortImportSettings
} from '../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../client/common/utils/async';
import { Common, Diagnostics } from '../../client/common/utils/localize';
import { noop } from '../../client/common/utils/misc';
import { IServiceContainer } from '../../client/ioc/types';
import { SortImportsEditingProvider } from '../../client/providers/importSortProvider';
import { sleep } from '../core';

const ISOLATED = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'pyvsc-run-isolated.py');

suite('Import Sort Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let shell: TypeMoq.IMock<IApplicationShell>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let pythonExecFactory: TypeMoq.IMock<IPythonExecutionFactory>;
    let processServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let editorUtils: TypeMoq.IMock<IEditorUtils>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let sortProvider: SortImportsEditingProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        shell = TypeMoq.Mock.ofType<IApplicationShell>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonExecFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        editorUtils = TypeMoq.Mock.ofType<IEditorUtils>();
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        serviceContainer.setup((c) => c.get(IOutputChannel, STANDARD_OUTPUT_CHANNEL)).returns(() => output.object);
        serviceContainer.setup((c) => c.get(IPersistentStateFactory)).returns(() => persistentStateFactory.object);
        serviceContainer.setup((c) => c.get(ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup((c) => c.get(IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup((c) => c.get(IApplicationShell)).returns(() => shell.object);
        serviceContainer.setup((c) => c.get(IConfigurationService)).returns(() => configurationService.object);
        serviceContainer.setup((c) => c.get(IPythonExecutionFactory)).returns(() => pythonExecFactory.object);
        serviceContainer.setup((c) => c.get(IProcessServiceFactory)).returns(() => processServiceFactory.object);
        serviceContainer.setup((c) => c.get(IEditorUtils)).returns(() => editorUtils.object);
        serviceContainer.setup((c) => c.get(IDisposableRegistry)).returns(() => []);
        configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        sortProvider = new SortImportsEditingProvider(serviceContainer.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Ensure command is registered', () => {
        commandManager
            .setup((c) =>
                c.registerCommand(
                    TypeMoq.It.isValue(Commands.Sort_Imports),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(sortProvider)
                )
            )
            .verifiable(TypeMoq.Times.once());

        sortProvider.registerCommands();
        commandManager.verifyAll();
    });
    test("Ensure message is displayed when no doc is opened and uri isn't provided", async () => {
        documentManager
            .setup((d) => d.activeTextEditor)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await sortProvider.sortImports();

        shell.verifyAll();
        documentManager.verifyAll();
    });
    test("Ensure message is displayed when uri isn't provided and current doc is non-python", async () => {
        const mockEditor = TypeMoq.Mock.ofType<TextEditor>();
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        mockDoc
            .setup((d) => d.languageId)
            .returns(() => 'xyz')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockEditor
            .setup((d) => d.document)
            .returns(() => mockDoc.object)
            .verifiable(TypeMoq.Times.atLeastOnce());

        documentManager
            .setup((d) => d.activeTextEditor)
            .returns(() => mockEditor.object)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await sortProvider.sortImports();

        mockEditor.verifyAll();
        mockDoc.verifyAll();
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure document is opened', async () => {
        const uri = Uri.file('TestDoc');

        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager.setup((d) => d.activeTextEditor).verifiable(TypeMoq.Times.never());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        await sortProvider.sortImports(uri).catch(noop);

        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure no edits are provided when there is only one line', async () => {
        const uri = Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        // tslint:disable-next-line:no-any
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = await sortProvider.sortImports(uri);

        expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure no edits are provided when there are no lines', async () => {
        const uri = Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        // tslint:disable-next-line:no-any
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = await sortProvider.sortImports(uri);

        expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure empty line is added when line does not end with an empty line', async () => {
        const uri = Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());

        const lastLine = TypeMoq.Mock.ofType<TextLine>();
        let editApplied: WorkspaceEdit | undefined;
        lastLine
            .setup((l) => l.text)
            .returns(() => '1234')
            .verifiable(TypeMoq.Times.atLeastOnce());
        lastLine
            .setup((l) => l.range)
            .returns(() => new Range(1, 0, 10, 1))
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup((d) => d.lineAt(TypeMoq.It.isValue(9)))
            .returns(() => lastLine.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.applyEdit(TypeMoq.It.isAny()))
            .callback((e) => (editApplied = e))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        sortProvider.provideDocumentSortImportsEdits = () => Promise.resolve(undefined);
        await sortProvider.sortImports(uri);

        expect(editApplied).not.to.be.equal(undefined, 'Applied edit is undefined');
        expect(editApplied!.entries()).to.be.lengthOf(1);
        expect(editApplied!.entries()[0][1]).to.be.lengthOf(1);
        expect(editApplied!.entries()[0][1][0].newText).to.be.equal(EOL);
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure no edits are provided when there is only one line (when using provider method)', async () => {
        const uri = Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    });

    test('Ensure no edits are provided when there are no lines (when using provider method)', async () => {
        const uri = Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup((s) => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    });

    test('Ensure stdin is used for sorting (with custom isort path)', async () => {
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup((d) => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup((d) => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.never());
        mockDoc
            .setup((d) => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        pythonSettings
            .setup((s) => s.sortImports)
            .returns(() => {
                return ({ path: 'CUSTOM_ISORT', args: ['1', '2'] } as any) as ISortImportSettings;
            })
            .verifiable(TypeMoq.Times.once());
        processServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object))
            .verifiable(TypeMoq.Times.once());

        let actualSubscriber: Subscriber<Output<string>>;
        const stdinStream = TypeMoq.Mock.ofType<Writable>();
        stdinStream.setup((s) => s.write('Hello')).verifiable(TypeMoq.Times.once());
        stdinStream
            .setup((s) => s.end())
            .callback(() => {
                actualSubscriber.next({ source: 'stdout', out: 'DIFF' });
                actualSubscriber.complete();
            })
            .verifiable(TypeMoq.Times.once());
        const childProcess = TypeMoq.Mock.ofType<ChildProcess>();
        childProcess.setup((p) => p.stdin).returns(() => stdinStream.object);
        const executionResult = {
            proc: childProcess.object,
            out: new Observable<Output<string>>((subscriber) => (actualSubscriber = subscriber)),
            dispose: noop
        };
        const expectedArgs = ['-', '--diff', '1', '2'];
        processService
            .setup((p) =>
                p.execObservable(
                    TypeMoq.It.isValue('CUSTOM_ISORT'),
                    TypeMoq.It.isValue(expectedArgs),
                    TypeMoq.It.isValue({ token: undefined, cwd: path.sep })
                )
            )
            .returns(() => executionResult)
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new WorkspaceEdit();
        editorUtils
            .setup((e) =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());

        const edit = await sortProvider._provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(expectedEdit);
        shell.verifyAll();
        mockDoc.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure stdin is used for sorting', async () => {
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup((d) => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup((d) => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup((d) => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.never());
        mockDoc
            .setup((d) => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        pythonSettings
            .setup((s) => s.sortImports)
            .returns(() => {
                return ({ args: ['1', '2'] } as any) as ISortImportSettings;
            })
            .verifiable(TypeMoq.Times.once());

        const processExeService = TypeMoq.Mock.ofType<IPythonExecutionService>();
        processExeService.setup((p: any) => p.then).returns(() => undefined);
        pythonExecFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processExeService.object))
            .verifiable(TypeMoq.Times.once());

        let actualSubscriber: Subscriber<Output<string>>;
        const stdinStream = TypeMoq.Mock.ofType<Writable>();
        stdinStream.setup((s) => s.write('Hello')).verifiable(TypeMoq.Times.once());
        stdinStream
            .setup((s) => s.end())
            .callback(() => {
                actualSubscriber.next({ source: 'stdout', out: 'DIFF' });
                actualSubscriber.complete();
            })
            .verifiable(TypeMoq.Times.once());
        const childProcess = TypeMoq.Mock.ofType<ChildProcess>();
        childProcess.setup((p) => p.stdin).returns(() => stdinStream.object);
        const executionResult = {
            proc: childProcess.object,
            out: new Observable<Output<string>>((subscriber) => (actualSubscriber = subscriber)),
            dispose: noop
        };
        const importScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py');
        const expectedArgs = [ISOLATED, importScript, '-', '--diff', '1', '2'];
        processExeService
            .setup((p) =>
                p.execObservable(
                    TypeMoq.It.isValue(expectedArgs),
                    TypeMoq.It.isValue({ token: undefined, cwd: path.sep })
                )
            )
            .returns(() => executionResult)
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new WorkspaceEdit();
        editorUtils
            .setup((e) =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());

        const edit = await sortProvider._provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(expectedEdit);
        shell.verifyAll();
        mockDoc.verifyAll();
        documentManager.verifyAll();
    });

    test('If a second sort command is initiated before the execution of first one is finished, discard the result from first isort process', async () => {
        // ----------------------Common setup between the 2 commands---------------------------
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d) => d.lineCount).returns(() => 10);
        mockDoc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => 'Hello');
        mockDoc.setup((d) => d.isDirty).returns(() => true);
        mockDoc.setup((d) => d.uri).returns(() => uri);
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object));
        pythonSettings
            .setup((s) => s.sortImports)
            .returns(() => {
                return ({ path: 'CUSTOM_ISORT', args: [] } as any) as ISortImportSettings;
            });
        processServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));
        const result = new WorkspaceEdit();
        editorUtils
            .setup((e) =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => result);

        // ----------------------Run the command once----------------------
        let firstSubscriber: Subscriber<Output<string>>;
        const firstProcessResult = createDeferred<Output<string> | undefined>();
        const stdinStream1 = TypeMoq.Mock.ofType<Writable>();
        stdinStream1.setup((s) => s.write('Hello'));
        stdinStream1
            .setup((s) => s.end())
            .callback(async () => {
                // Wait until the process has returned with results
                const processResult = await firstProcessResult.promise;
                firstSubscriber.next(processResult);
                firstSubscriber.complete();
            })
            .verifiable(TypeMoq.Times.once());
        const firstChildProcess = TypeMoq.Mock.ofType<ChildProcess>();
        firstChildProcess.setup((p) => p.stdin).returns(() => stdinStream1.object);
        const firstExecutionResult = {
            proc: firstChildProcess.object,
            out: new Observable<Output<string>>((subscriber) => (firstSubscriber = subscriber)),
            dispose: noop
        };
        processService
            .setup((p) => p.execObservable(TypeMoq.It.isValue('CUSTOM_ISORT'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => firstExecutionResult);

        // The first execution isn't immediately resolved, so don't wait on the promise
        const firstExecutionDeferred = createDeferredFromPromise(sortProvider.provideDocumentSortImportsEdits(uri));
        // Yield control to the first execution, so all the mock setups are used.
        await sleep(1);

        // ----------------------Run the command again----------------------
        let secondSubscriber: Subscriber<Output<string>>;
        const stdinStream2 = TypeMoq.Mock.ofType<Writable>();
        stdinStream2.setup((s) => s.write('Hello'));
        stdinStream2
            .setup((s) => s.end())
            .callback(() => {
                // The second process immediately returns with results
                secondSubscriber.next({ source: 'stdout', out: 'DIFF' });
                secondSubscriber.complete();
            })
            .verifiable(TypeMoq.Times.once());
        const secondChildProcess = TypeMoq.Mock.ofType<ChildProcess>();
        secondChildProcess.setup((p) => p.stdin).returns(() => stdinStream2.object);
        const secondExecutionResult = {
            proc: secondChildProcess.object,
            out: new Observable<Output<string>>((subscriber) => (secondSubscriber = subscriber)),
            dispose: noop
        };
        processService.reset();
        processService.setup((d: any) => d.then).returns(() => undefined);
        processService
            .setup((p) => p.execObservable(TypeMoq.It.isValue('CUSTOM_ISORT'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => secondExecutionResult);

        // // The second execution should immediately return with results
        let edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        // ----------------------Verify results----------------------
        expect(edit).to.be.equal(result, 'Second execution result is incorrect');
        expect(firstExecutionDeferred.completed).to.equal(false, "The first execution shouldn't finish yet");
        stdinStream2.verifyAll();

        // The first process returns with results
        firstProcessResult.resolve({ source: 'stdout', out: 'DIFF' });

        edit = await firstExecutionDeferred.promise;
        expect(edit).to.be.equal(undefined, 'The results from the first execution should be discarded');
        stdinStream1.verifyAll();
    });

    test('If isort raises a warning message related to isort5 upgrade guide, show message', async () => {
        const _showWarningAndOptionallyShowOutput = sinon.stub(
            SortImportsEditingProvider.prototype,
            '_showWarningAndOptionallyShowOutput'
        );
        _showWarningAndOptionallyShowOutput.resolves();
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d) => d.lineCount).returns(() => 10);
        mockDoc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => 'Hello');
        mockDoc.setup((d) => d.isDirty).returns(() => true);
        mockDoc.setup((d) => d.uri).returns(() => uri);
        documentManager
            .setup((d) => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object));
        pythonSettings
            .setup((s) => s.sortImports)
            .returns(() => {
                return ({ path: 'CUSTOM_ISORT', args: [] } as any) as ISortImportSettings;
            });
        processServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));
        const result = new WorkspaceEdit();
        editorUtils
            .setup((e) =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => result);

        // ----------------------Run the command----------------------
        let subscriber: Subscriber<Output<string>>;
        const stdinStream = TypeMoq.Mock.ofType<Writable>();
        stdinStream.setup((s) => s.write('Hello'));
        stdinStream
            .setup((s) => s.end())
            .callback(() => {
                subscriber.next({ source: 'stdout', out: 'DIFF' });
                subscriber.next({ source: 'stderr', out: 'Some warning related to isort5 (W0503)' });
                subscriber.complete();
            })
            .verifiable(TypeMoq.Times.once());
        const childProcess = TypeMoq.Mock.ofType<ChildProcess>();
        childProcess.setup((p) => p.stdin).returns(() => stdinStream.object);
        const executionResult = {
            proc: childProcess.object,
            out: new Observable<Output<string>>((s) => (subscriber = s)),
            dispose: noop
        };
        processService.reset();
        processService.setup((d: any) => d.then).returns(() => undefined);
        processService
            .setup((p) => p.execObservable(TypeMoq.It.isValue('CUSTOM_ISORT'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => executionResult);

        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        // ----------------------Verify results----------------------
        expect(edit).to.be.equal(result, 'Execution result is incorrect');
        assert.ok(_showWarningAndOptionallyShowOutput.calledOnce);
        stdinStream.verifyAll();
    });

    test('If user clicks show output on the isort5 warning prompt, show the Python output', async () => {
        const neverShowAgain = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), false))
            .returns(() => neverShowAgain.object);
        neverShowAgain.setup((p) => p.value).returns(() => false);
        shell
            .setup((s) =>
                s.showWarningMessage(
                    Diagnostics.checkIsort5UpgradeGuide(),
                    Common.openOutputPanel(),
                    Common.doNotShowAgain()
                )
            )
            .returns(() => Promise.resolve(Common.openOutputPanel()));
        output.setup((o) => o.show(true)).verifiable(TypeMoq.Times.once());
        await sortProvider._showWarningAndOptionallyShowOutput();
        output.verifyAll();
    });

    test('If user clicks do not show again on the isort5 warning prompt, do not show the prompt again', async () => {
        const neverShowAgain = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), false))
            .returns(() => neverShowAgain.object);
        let doNotShowAgainValue = false;
        neverShowAgain.setup((p) => p.value).returns(() => doNotShowAgainValue);
        neverShowAgain
            .setup((p) => p.updateValue(true))
            .returns(() => {
                doNotShowAgainValue = true;
                return Promise.resolve();
            });
        shell
            .setup((s) =>
                s.showWarningMessage(
                    Diagnostics.checkIsort5UpgradeGuide(),
                    Common.openOutputPanel(),
                    Common.doNotShowAgain()
                )
            )
            .returns(() => Promise.resolve(Common.doNotShowAgain()))
            .verifiable(TypeMoq.Times.once());

        await sortProvider._showWarningAndOptionallyShowOutput();
        shell.verifyAll();

        await sortProvider._showWarningAndOptionallyShowOutput();
        await sortProvider._showWarningAndOptionallyShowOutput();
        shell.verifyAll();
    });
});
