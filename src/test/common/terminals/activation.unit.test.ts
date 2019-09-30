// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Terminal, Uri } from 'vscode';
import { DocumentManager } from '../../../client/common/application/documentManager';
import { TerminalManager } from '../../../client/common/application/terminalManager';
import { IDocumentManager, ITerminalManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { TerminalActivator } from '../../../client/common/terminal/activator';
import { ITerminalActivator } from '../../../client/common/terminal/types';
import { IDisposable } from '../../../client/common/types';
import { TerminalAutoActivation } from '../../../client/terminals/activation';
import { ITerminalAutoActivation } from '../../../client/terminals/types';

suite('Terminal Auto Activation', () => {
    let activator: ITerminalActivator;
    let documentManager: IDocumentManager;
    let terminalManager: ITerminalManager;
    let terminalAutoActivation: ITerminalAutoActivation;
    let workspaceService: IWorkspaceService;

    setup(() => {
        terminalManager = mock(TerminalManager);
        documentManager = mock(DocumentManager);
        activator = mock(TerminalActivator);
        workspaceService = mock(WorkspaceService);

        terminalAutoActivation = new TerminalAutoActivation(
            instance(terminalManager),
            [],
            instance(documentManager),
            instance(activator),
            instance(workspaceService)
        );
    });

    test('New Terminals should be activated', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything(), anything())).thenResolve();
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);

        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, undefined)).once();
    });
    test('New Terminals should be activated with resource of single workspace', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        const resource = Uri.file(__filename);
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything(), anything())).thenResolve();
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([{ index: 0, name: '', uri: resource }]);

        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, resource)).once();
    });
    test('New Terminals should be activated with resource of main workspace', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        const resource = Uri.file(__filename);
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything(), anything())).thenResolve();
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: resource },
            { index: 2, name: '2', uri: Uri.file('1234') }
        ]);

        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, resource)).once();
    });
});
