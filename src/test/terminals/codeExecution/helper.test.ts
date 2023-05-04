// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Position, Range, Selection, TextDocument, TextEditor, TextLine, Uri } from 'vscode';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService,
} from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../../client/common/constants';
import '../../../client/common/extensions';
import { ProcessService } from '../../../client/common/process/proc';
import {
    IProcessService,
    IProcessServiceFactory,
    ObservableExecutionResult,
} from '../../../client/common/process/types';
import { Architecture } from '../../../client/common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { CodeExecutionHelper } from '../../../client/terminals/codeExecution/helper';
import { ICodeExecutionHelper } from '../../../client/terminals/types';
import { PYTHON_PATH } from '../../common';

const TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'terminalExec');

suite('Terminal - Code Execution Helper', () => {
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let applicationShell: TypeMoq.IMock<IApplicationShell>;
    let helper: ICodeExecutionHelper;
    let document: TypeMoq.IMock<TextDocument>;
    let editor: TypeMoq.IMock<TextEditor>;
    let processService: TypeMoq.IMock<IProcessService>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    const workingPython: PythonEnvironment = {
        path: PYTHON_PATH,
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        displayName: 'Python',
        envType: EnvironmentType.Unknown,
        architecture: Architecture.x64,
    };

    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        applicationShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const envVariablesProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processService.setup((x: any) => x.then).returns(() => undefined);
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(workingPython));
        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        processServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));
        envVariablesProvider
            .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({}));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny()))
            .returns(() => processServiceFactory.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny()))
            .returns(() => interpreterService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDocumentManager), TypeMoq.It.isAny()))
            .returns(() => documentManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny()))
            .returns(() => applicationShell.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => commandManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider), TypeMoq.It.isAny()))
            .returns(() => envVariablesProvider.object);
        helper = new CodeExecutionHelper(serviceContainer.object);

        document = TypeMoq.Mock.ofType<TextDocument>();
        editor = TypeMoq.Mock.ofType<TextEditor>();
        editor.setup((e) => e.document).returns(() => document.object);
    });

    test('normalizeLines should call normalizeSelection.py', async () => {
        let execArgs = '';

        processService
            .setup((p) => p.execObservable(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_, args: string[]) => {
                execArgs = args.join(' ');
                return ({} as unknown) as ObservableExecutionResult<string>;
            });

        await helper.normalizeLines('print("hello")');

        expect(execArgs).to.contain('normalizeSelection.py');
    });

    async function ensureCodeIsNormalized(source: string, expectedSource: string) {
        const actualProcessService = new ProcessService();
        processService
            .setup((p) => p.execObservable(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((file, args, options) =>
                actualProcessService.execObservable.apply(actualProcessService, [file, args, options]),
            );
        const normalizedCode = await helper.normalizeLines(source);
        const normalizedExpected = expectedSource.replace(/\r\n/g, '\n');
        expect(normalizedCode).to.be.equal(normalizedExpected);
    }

    ['', '1', '2', '3', '4', '5', '6', '7', '8'].forEach((fileNameSuffix) => {
        test(`Ensure code is normalized (Sample${fileNameSuffix})`, async () => {
            const code = await fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
            const expectedCode = await fs.readFile(
                path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized_selection.py`),
                'utf8',
            );

            await ensureCodeIsNormalized(code, expectedCode);
        });
    });

    test("Display message if there's no active file", async () => {
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => undefined);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.an('undefined');
        applicationShell.verify((a) => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    });

    test('Display message if active file is unsaved', async () => {
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);
        document.setup((doc) => doc.isUntitled).returns(() => true);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.an('undefined');
        applicationShell.verify((a) => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    });

    test('Display message if active file is non-python', async () => {
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.languageId).returns(() => 'html');
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.an('undefined');
        applicationShell.verify((a) => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    });

    test('Returns file uri', async () => {
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        const expectedUri = Uri.file('one.py');
        document.setup((doc) => doc.uri).returns(() => expectedUri);
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.deep.equal(expectedUri);
    });

    test('Returns file uri even if saving fails', async () => {
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.isDirty).returns(() => true);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        document.setup((doc) => doc.save()).returns(() => Promise.resolve(false));
        const expectedUri = Uri.file('one.py');
        document.setup((doc) => doc.uri).returns(() => expectedUri);
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.deep.equal(expectedUri);
    });

    test('Dirty files are saved', async () => {
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.isDirty).returns(() => true);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        const expectedUri = Uri.file('one.py');
        document.setup((doc) => doc.uri).returns(() => expectedUri);
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.deep.equal(expectedUri);
        document.verify((doc) => doc.save(), TypeMoq.Times.once());
    });

    test('Non-Dirty files are not-saved', async () => {
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.isDirty).returns(() => false);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        const expectedUri = Uri.file('one.py');
        document.setup((doc) => doc.uri).returns(() => expectedUri);
        documentManager.setup((doc) => doc.activeTextEditor).returns(() => editor.object);

        const uri = await helper.getFileToExecute();
        expect(uri).to.be.deep.equal(expectedUri);
        document.verify((doc) => doc.save(), TypeMoq.Times.never());
    });

    test('Selection is empty, return current line', async () => {
        const lineContents = '    Line Contents';
        editor.setup((e) => e.selection).returns(() => new Selection(3, 0, 3, 0));
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => lineContents);
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(lineContents);
    });

    test('Single line: text selection without whitespace ', async () => {
        // This test verifies following case:
        // 1: if (x):
        // 2:    print(x)
        // 3:    ↑------↑   <--- selection range
        const expected = '    print(x)';
        editor.setup((e) => e.selection).returns(() => new Selection(2, 4, 2, 12));
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => '    print(x)');
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);
        document.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => 'print(x)');

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(expected);
    });

    test('Single line: partial text selection without whitespace ', async () => {
        // This test verifies following case:
        // 1: if (isPrime(x) || isFibonacci(x)):
        // 2:     ↑--------↑    <--- selection range
        const expected = 'isPrime(x)';
        editor.setup((e) => e.selection).returns(() => new Selection(1, 4, 1, 14));
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => 'if (isPrime(x) || isFibonacci(x)):');
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);
        document.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => 'isPrime(x)');

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(expected);
    });

    test('Multi-line: text selection without whitespace ', async () => {
        // This test verifies following case:
        // 1: def calc(m, n):
        //        ↓<------------------------------- selection start
        // 2:     print(m)
        // 3:     print(n)
        //               ↑<------------------------ selection end
        const expected = '    print(m)\n    print(n)';
        const selection = new Selection(2, 4, 3, 12);
        editor.setup((e) => e.selection).returns(() => selection);
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => 'def calc(m, n):');
        const textLine2 = TypeMoq.Mock.ofType<TextLine>();
        textLine2.setup((t) => t.text).returns(() => '    print(m)');
        const textLine3 = TypeMoq.Mock.ofType<TextLine>();
        textLine3.setup((t) => t.text).returns(() => '    print(n)');
        const textLines = [textLine, textLine2, textLine3];
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns((r: number) => textLines[r - 1].object);
        document
            .setup((d) => d.getText(new Range(selection.start, selection.end)))
            .returns(() => 'print(m)\n    print(n)');
        document
            .setup((d) => d.getText(new Range(new Position(selection.start.line, 0), selection.end)))
            .returns(() => '    print(m)\n    print(n)');

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(expected);
    });

    test('Multi-line: text selection without whitespace and partial last line ', async () => {
        // This test verifies following case:
        // 1: def calc(m, n):
        //        ↓<------------------------------ selection start
        // 2:     if (m == 0):
        // 3:         return n + 1
        //                   ↑<------------------- selection end (notice " + 1" is not selected)
        const expected = '    if (m == 0):\n        return n';
        const selection = new Selection(2, 4, 3, 16);
        editor.setup((e) => e.selection).returns(() => selection);
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => 'def calc(m, n):');
        const textLine2 = TypeMoq.Mock.ofType<TextLine>();
        textLine2.setup((t) => t.text).returns(() => '    if (m == 0):');
        const textLine3 = TypeMoq.Mock.ofType<TextLine>();
        textLine3.setup((t) => t.text).returns(() => '        return n + 1');
        const textLines = [textLine, textLine2, textLine3];
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns((r: number) => textLines[r - 1].object);
        document
            .setup((d) => d.getText(new Range(selection.start, selection.end)))
            .returns(() => 'if (m == 0):\n        return n');
        document
            .setup((d) =>
                d.getText(new Range(new Position(selection.start.line, 4), new Position(selection.start.line, 16))),
            )
            .returns(() => 'if (m == 0):');
        document
            .setup((d) =>
                d.getText(new Range(new Position(selection.start.line, 0), new Position(selection.end.line, 20))),
            )
            .returns(() => '    if (m == 0):\n        return n + 1');

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(expected);
    });

    test('Multi-line: partial first and last line', async () => {
        // This test verifies following case:
        // 1: def calc(m, n):
        //           ↓<------------------------------- selection start
        // 2:     if (m > 0
        // 3:         and n == 0):
        //                      ↑<-------------------- selection end
        // 4:        pass
        const expected = '(m > 0\n        and n == 0)';
        const selection = new Selection(2, 7, 3, 19);
        editor.setup((e) => e.selection).returns(() => selection);
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => 'def calc(m, n):');
        const textLine2 = TypeMoq.Mock.ofType<TextLine>();
        textLine2.setup((t) => t.text).returns(() => '    if (m > 0');
        const textLine3 = TypeMoq.Mock.ofType<TextLine>();
        textLine3.setup((t) => t.text).returns(() => '        and n == 0)');
        const textLines = [textLine, textLine2, textLine3];
        document.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns((r: number) => textLines[r - 1].object);
        document
            .setup((d) => d.getText(new Range(selection.start, selection.end)))
            .returns(() => '(m > 0\n        and n == 0)');
        document
            .setup((d) =>
                d.getText(new Range(new Position(selection.start.line, 7), new Position(selection.start.line, 13))),
            )
            .returns(() => '(m > 0');
        document
            .setup((d) =>
                d.getText(new Range(new Position(selection.start.line, 0), new Position(selection.end.line, 19))),
            )
            .returns(() => '    if (m > 0\n        and n == 0)');

        const content = await helper.getSelectedTextToExecute(editor.object);
        expect(content).to.be.equal(expected);
    });

    test('saveFileIfDirty will not fail if file is not opened', async () => {
        documentManager
            .setup((d) => d.textDocuments)
            .returns(() => [])
            .verifiable(TypeMoq.Times.once());

        await helper.saveFileIfDirty(Uri.file(`${__filename}.py`));
        documentManager.verifyAll();
    });

    test('File will be saved if file is dirty', async () => {
        documentManager
            .setup((d) => d.textDocuments)
            .returns(() => [document.object])
            .verifiable(TypeMoq.Times.once());
        document.setup((doc) => doc.isUntitled).returns(() => true);
        document.setup((doc) => doc.isDirty).returns(() => true);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        const untitledUri = Uri.file('Untitled-1');
        document.setup((doc) => doc.uri).returns(() => untitledUri);
        const expectedSavedUri = Uri.file('one.py');
        workspaceService.setup((w) => w.saveAs(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedSavedUri));

        const savedUri = await helper.saveFileIfDirty(untitledUri);

        expect(savedUri?.fsPath).to.be.equal(expectedSavedUri.fsPath);
    });

    test('File will be not saved if file is not dirty', async () => {
        documentManager
            .setup((d) => d.textDocuments)
            .returns(() => [document.object])
            .verifiable(TypeMoq.Times.once());
        document.setup((doc) => doc.isUntitled).returns(() => false);
        document.setup((doc) => doc.isDirty).returns(() => false);
        document.setup((doc) => doc.languageId).returns(() => PYTHON_LANGUAGE);
        const expectedUri = Uri.file('one.py');
        document.setup((doc) => doc.uri).returns(() => expectedUri);

        await helper.saveFileIfDirty(expectedUri);
        documentManager.verifyAll();
        document.verify((doc) => doc.save(), TypeMoq.Times.never());
    });
});
