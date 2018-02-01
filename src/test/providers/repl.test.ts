// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { IServiceContainer } from '../../client/ioc/types';
import { ReplProvider } from '../../client/providers/replProvider';
import { ICodeExecutionService } from '../../client/terminals/types';

// tslint:disable-next-line:max-func-body-length
suite('REPL Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let codeExecutionService: TypeMoq.IMock<ICodeExecutionService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let replProvider: ReplProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        codeExecutionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceContainer.setup(c => c.get(ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(ICodeExecutionService, TypeMoq.It.isValue('repl'))).returns(() => codeExecutionService.object);
        serviceContainer.setup(c => c.get(IDocumentManager)).returns(() => documentManager.object);
    });
    teardown(() => {
        try {
            replProvider.dispose();
            // tslint:disable-next-line:no-empty
        } catch { }
    });

    test('Ensure command is registered', () => {
        replProvider = new ReplProvider(serviceContainer.object);
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Ensure command handler is disposed', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => disposable.object);

        replProvider = new ReplProvider(serviceContainer.object);
        replProvider.dispose();

        disposable.verify(d => d.dispose(), TypeMoq.Times.once());
    });

    test('Ensure resource is \'undefined\' if there\s no active document nor a workspace', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);

        replProvider = new ReplProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler!.call(replProvider);

        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(undefined)), TypeMoq.Times.once());
    });

    test('Ensure resource is uri of the active document', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const documentUri = Uri.file('a');
        const editor = TypeMoq.Mock.ofType<TextEditor>();
        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(d => d.uri).returns(() => documentUri);
        document.setup(d => d.isUntitled).returns(() => false);
        editor.setup(e => e.document).returns(() => document.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);

        replProvider = new ReplProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler!.call(replProvider);

        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(documentUri)), TypeMoq.Times.once());
    });

    test('Ensure resource is \'undefined\' if the active document is not used if it is untitled (new document)', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType<TextEditor>();
        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(d => d.isUntitled).returns(() => true);
        editor.setup(e => e.document).returns(() => document.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);

        replProvider = new ReplProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler!.call(replProvider);

        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(undefined)), TypeMoq.Times.once());
    });

    test('Ensure first available workspace folder is used if there no document', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);

        const workspaceUri = Uri.file('a');
        const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
        workspaceFolder.setup(w => w.uri).returns(() => workspaceUri);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder.object]);

        replProvider = new ReplProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler!.call(replProvider);

        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(workspaceUri)), TypeMoq.Times.once());
    });
});
