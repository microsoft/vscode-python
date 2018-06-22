// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { TerminalService } from '../../client/common/terminal/service';
import { ITerminalServiceFactory } from '../../client/common/terminal/types';
import { IServiceContainer } from '../../client/ioc/types';
import { TerminalProvider } from '../../client/providers/terminalProvider';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let terminalProvider: TerminalProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceContainer.setup(c => c.get(ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(IDocumentManager)).returns(() => documentManager.object);
    });
    teardown(() => {
        try {
            terminalProvider.dispose();
            // tslint:disable-next-line:no-empty
        } catch { }
    });

    test('Ensure command is registered', () => {
        terminalProvider = new TerminalProvider(serviceContainer.object);
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Ensure command handler is disposed', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => disposable.object);

        terminalProvider = new TerminalProvider(serviceContainer.object);
        terminalProvider.dispose();

        disposable.verify(d => d.dispose(), TypeMoq.Times.once());
    });

    test('Ensure terminal is created and displayed when command is invoked', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);

        terminalProvider = new TerminalProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');

        const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType<TerminalService>();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);

        commandHandler!.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });

    test('Ensure terminal creation does not use uri of the active documents which is untitled', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType<TextEditor>();
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(d => d.isUntitled).returns(() => true);
        editor.setup(e => e.document).returns(() => document.object);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);

        terminalProvider = new TerminalProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');

        const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType<TerminalService>();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);

        commandHandler!.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });

    test('Ensure terminal creation uses uri of active document', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType<TextEditor>();
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        const document = TypeMoq.Mock.ofType<TextDocument>();
        const documentUri = Uri.file('a');
        document.setup(d => d.isUntitled).returns(() => false);
        document.setup(d => d.uri).returns(() => documentUri);
        editor.setup(e => e.document).returns(() => document.object);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);

        terminalProvider = new TerminalProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');

        const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType<TerminalService>();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(documentUri), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);

        commandHandler!.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });

    test('Ensure terminal creation uses uri of active workspace', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        const workspaceUri = Uri.file('a');
        const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
        workspaceFolder.setup(w => w.uri).returns(() => workspaceUri);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder.object]);

        terminalProvider = new TerminalProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');

        const terminalServiceFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType<TerminalService>();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);

        commandHandler!.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });
});
