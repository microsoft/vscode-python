// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-multiline-string no-trailing-whitespace

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { IServiceContainer } from '../../../client/ioc/types';
import { CodeExecutionManager } from '../../../client/terminals/codeExecution/codeExecutionManager';
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from '../../../client/terminals/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal - Code Execution Manager', () => {
    let executionManager: ICodeExecutionManager;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let disposables: Disposable[] = [];
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    setup(() => {
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspace.setup(c => c.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return {
                dispose: () => void 0
            };
        });
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        executionManager = new CodeExecutionManager(commandManager.object, documentManager.object, disposables, serviceContainer.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });

        disposables = [];
    });

    test('Ensure commands are registered', async () => {
        executionManager.registerCommands();
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(Commands.Exec_In_Terminal), TypeMoq.It.isAny()), TypeMoq.Times.once());
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(Commands.Exec_Selection_In_Terminal), TypeMoq.It.isAny()), TypeMoq.Times.once());
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(Commands.Exec_Selection_In_Django_Shell), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Ensure executeFileInterTerminal will do nothing if no file is avialble', async () => {
        let commandHandler: undefined | (() => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);

        await commandHandler!();
        helper.verify(async h => h.getFileToExecute(), TypeMoq.Times.once());
    });

    test('Ensure executeFileInterTerminal will use provided file', async () => {
        let commandHandler: undefined | ((file: Uri) => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);

        const executionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('standard'))).returns(() => executionService.object);

        const fileToExecute = Uri.file('x');
        await commandHandler!(fileToExecute);
        helper.verify(async h => h.getFileToExecute(), TypeMoq.Times.never());
        executionService.verify(async e => e.executeFile(TypeMoq.It.isValue(fileToExecute)), TypeMoq.Times.once());
    });

    test('Ensure executeFileInterTerminal will use active file', async () => {
        let commandHandler: undefined | ((file: Uri) => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const fileToExecute = Uri.file('x');
        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);
        helper.setup(async h => h.getFileToExecute()).returns(() => Promise.resolve(fileToExecute));
        const executionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('standard'))).returns(() => executionService.object);

        await commandHandler!(fileToExecute);
        executionService.verify(async e => e.executeFile(TypeMoq.It.isValue(fileToExecute)), TypeMoq.Times.once());
    });

    async function testExecutionOfSelectionWithoutAnyActiveDocument(commandId: string, executionSericeId: string) {
        let commandHandler: undefined | (() => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === commandId) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);
        const executionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue(executionSericeId))).returns(() => executionService.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);

        await commandHandler!();
        executionService.verify(async e => e.execute(TypeMoq.It.isAny()), TypeMoq.Times.never());
    }

    test('Ensure executeSelectionInTerminal will do nothing if theres no active document', async () => {
        await testExecutionOfSelectionWithoutAnyActiveDocument(Commands.Exec_Selection_In_Terminal, 'standard');
    });

    test('Ensure executeSelectionInDjangoShell will do nothing if theres no active document', async () => {
        await testExecutionOfSelectionWithoutAnyActiveDocument(Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    });

    async function testExecutionOfSlectionWithoutAnythingSelected(commandId: string, executionServiceId: string) {
        let commandHandler: undefined | (() => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === commandId) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);
        helper.setup(h => h.getSelectedTextToExecute).returns(() => () => Promise.resolve(''));
        const executionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue(executionServiceId))).returns(() => executionService.object);
        // tslint:disable-next-line:no-any
        documentManager.setup(d => d.activeTextEditor).returns(() => { return {} as any; });

        await commandHandler!();
        executionService.verify(async e => e.execute(TypeMoq.It.isAny()), TypeMoq.Times.never());
    }

    test('Ensure executeSelectionInTerminal will do nothing if no text is selected', async () => {
        await testExecutionOfSlectionWithoutAnythingSelected(Commands.Exec_Selection_In_Terminal, 'standard');
    });

    test('Ensure executeSelectionInDjangoShell will do nothing if no text is selected', async () => {
        await testExecutionOfSlectionWithoutAnythingSelected(Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    });

    async function testExecutionOfSelectionIsSentToTerminal(commandId: string, executionServiceId: string) {
        let commandHandler: undefined | (() => Promise<void>);
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === commandId) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        const textSelected = 'abcd';
        const activeDocumentUri = Uri.file('abc');
        const helper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionHelper))).returns(() => helper.object);
        helper.setup(h => h.getSelectedTextToExecute).returns(() => () => Promise.resolve(textSelected));
        helper.setup(h => h.normalizeLines).returns(() => () => Promise.resolve(textSelected)).verifiable(TypeMoq.Times.once());
        const executionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue(executionServiceId))).returns(() => executionService.object);
        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(d => d.uri).returns(() => activeDocumentUri);
        const activeEditor = TypeMoq.Mock.ofType<TextEditor>();
        activeEditor.setup(e => e.document).returns(() => document.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => activeEditor.object);

        await commandHandler!();
        executionService.verify(async e => e.execute(TypeMoq.It.isValue(textSelected), TypeMoq.It.isValue(activeDocumentUri)), TypeMoq.Times.once());
        helper.verifyAll();
    }
    test('Ensure executeSelectionInTerminal will normalize selected text and send it to the terminal', async () => {
        await testExecutionOfSelectionIsSentToTerminal(Commands.Exec_Selection_In_Terminal, 'standard');
    });

    test('Ensure executeSelectionInDjangoShell will normalize selected text and send it to the terminal', async () => {
        await testExecutionOfSelectionIsSentToTerminal(Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    });
});
