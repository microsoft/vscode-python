// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import { EOL } from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Range, TextDocument, TextEditor, TextLine, Uri, WorkspaceEdit } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { Commands, EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IFileSystem, TemporaryFile } from '../../client/common/platform/types';
import { ProcessService } from '../../client/common/process/proc';
import {
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService
} from '../../client/common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IEditorUtils,
    IPythonSettings,
    ISortImportSettings
} from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { IServiceContainer } from '../../client/ioc/types';
import { SortImportsEditingProvider } from '../../client/providers/importSortProvider';
import { ISortImportsEditingProvider } from '../../client/providers/types';

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
    let sortProvider: ISortImportsEditingProvider;
    let fs: TypeMoq.IMock<IFileSystem>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        fs = TypeMoq.Mock.ofType<IFileSystem>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        shell = TypeMoq.Mock.ofType<IApplicationShell>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonExecFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        editorUtils = TypeMoq.Mock.ofType<IEditorUtils>();
        fs = TypeMoq.Mock.ofType<IFileSystem>();
        serviceContainer.setup(c => c.get(ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(IApplicationShell)).returns(() => shell.object);
        serviceContainer.setup(c => c.get(IConfigurationService)).returns(() => configurationService.object);
        serviceContainer.setup(c => c.get(IPythonExecutionFactory)).returns(() => pythonExecFactory.object);
        serviceContainer.setup(c => c.get(IProcessServiceFactory)).returns(() => processServiceFactory.object);
        serviceContainer.setup(c => c.get(IEditorUtils)).returns(() => editorUtils.object);
        serviceContainer.setup(c => c.get(IDisposableRegistry)).returns(() => []);
        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fs.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        sortProvider = new SortImportsEditingProvider(serviceContainer.object);
    });

    test('Ensure command is registered', () => {
        commandManager
            .setup(c =>
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
            .setup(d => d.activeTextEditor)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
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
            .setup(d => d.languageId)
            .returns(() => 'xyz')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockEditor
            .setup(d => d.document)
            .returns(() => mockDoc.object)
            .verifiable(TypeMoq.Times.atLeastOnce());

        documentManager
            .setup(d => d.activeTextEditor)
            .returns(() => mockEditor.object)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
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

        documentManager.setup(d => d.openTextDocument(TypeMoq.It.isValue(uri))).verifiable(TypeMoq.Times.atLeastOnce());
        documentManager.setup(d => d.activeTextEditor).verifiable(TypeMoq.Times.never());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
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
            .setup(d => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
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
            .setup(d => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
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
            .setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());

        const lastLine = TypeMoq.Mock.ofType<TextLine>();
        let editApplied: WorkspaceEdit | undefined;
        lastLine
            .setup(l => l.text)
            .returns(() => '1234')
            .verifiable(TypeMoq.Times.atLeastOnce());
        lastLine
            .setup(l => l.range)
            .returns(() => new Range(1, 0, 10, 1))
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.lineAt(TypeMoq.It.isValue(9)))
            .returns(() => lastLine.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.applyEdit(TypeMoq.It.isAny()))
            .callback(e => (editApplied = e))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
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
            .setup(d => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
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
            .setup(d => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure temporary file is created for sorting when document is dirty', async () => {
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        let tmpFileDisposed = false;
        const tmpFile: TemporaryFile = { filePath: 'TmpFile', dispose: () => (tmpFileDisposed = true) };
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup(f => f.createTemporaryFile(TypeMoq.It.isValue('.py')))
            .returns(() => Promise.resolve(tmpFile))
            .verifiable(TypeMoq.Times.once());
        fs.setup(f => f.writeFile(TypeMoq.It.isValue(tmpFile.filePath), TypeMoq.It.isValue('Hello')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        pythonSettings
            .setup(s => s.sortImports)
            .returns(() => {
                return ({ path: 'CUSTOM_ISORT', args: ['1', '2'] } as any) as ISortImportSettings;
            })
            .verifiable(TypeMoq.Times.once());
        processServiceFactory
            .setup(p => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object))
            .verifiable(TypeMoq.Times.once());

        const expectedArgs = [tmpFile.filePath, '--diff', '1', '2'];
        processService
            .setup(p =>
                p.exec(
                    TypeMoq.It.isValue('CUSTOM_ISORT'),
                    TypeMoq.It.isValue(expectedArgs),
                    TypeMoq.It.isValue({ throwOnStdErr: true, token: undefined })
                )
            )
            .returns(() => Promise.resolve({ stdout: 'DIFF' }))
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new WorkspaceEdit();
        editorUtils
            .setup(e =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());

        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(expectedEdit);
        expect(tmpFileDisposed).to.be.equal(true, 'Temporary file not disposed');
        shell.verifyAll();
        documentManager.verifyAll();
    });
    test('Ensure temporary file is created for sorting when document is dirty (with custom isort path)', async () => {
        const uri = Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType<TextDocument>();
        let tmpFileDisposed = false;
        const tmpFile: TemporaryFile = { filePath: 'TmpFile', dispose: () => (tmpFileDisposed = true) };
        const processService = TypeMoq.Mock.ofType<ProcessService>();
        processService.setup((d: any) => d.then).returns(() => undefined);
        mockDoc.setup((d: any) => d.then).returns(() => undefined);
        mockDoc
            .setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc
            .setup(d => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup(f => f.createTemporaryFile(TypeMoq.It.isValue('.py')))
            .returns(() => Promise.resolve(tmpFile))
            .verifiable(TypeMoq.Times.once());
        fs.setup(f => f.writeFile(TypeMoq.It.isValue(tmpFile.filePath), TypeMoq.It.isValue('Hello')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        pythonSettings
            .setup(s => s.sortImports)
            .returns(() => {
                return ({ args: ['1', '2'] } as any) as ISortImportSettings;
            })
            .verifiable(TypeMoq.Times.once());

        const processExeService = TypeMoq.Mock.ofType<IPythonExecutionService>();
        processExeService.setup((p: any) => p.then).returns(() => undefined);
        pythonExecFactory
            .setup(p => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processExeService.object))
            .verifiable(TypeMoq.Times.once());
        const importScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py');
        const expectedArgs = [importScript, tmpFile.filePath, '--diff', '1', '2'];
        processExeService
            .setup(p =>
                p.exec(TypeMoq.It.isValue(expectedArgs), TypeMoq.It.isValue({ throwOnStdErr: true, token: undefined }))
            )
            .returns(() => Promise.resolve({ stdout: 'DIFF' }))
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new WorkspaceEdit();
        editorUtils
            .setup(e =>
                e.getWorkspaceEditsFromPatch(
                    TypeMoq.It.isValue('Hello'),
                    TypeMoq.It.isValue('DIFF'),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());

        const edit = await sortProvider.provideDocumentSortImportsEdits(uri);

        expect(edit).to.be.equal(expectedEdit);
        expect(tmpFileDisposed).to.be.equal(true, 'Temporary file not disposed');
        shell.verifyAll();
        documentManager.verifyAll();
    });
});
