// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { TextDocument, Uri } from 'vscode';
import { ExtensionActivationManager } from '../../client/activation/activationManager';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { IExtensionActivationService } from '../../client/activation/types';
import { ApplicationDiagnostics } from '../../client/application/diagnostics/applicationDiagnostics';
import { IApplicationDiagnostics } from '../../client/application/types';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { IDisposable } from '../../client/common/types';
import { InterpreterAutoSelectionService } from '../../client/interpreter/autoSelection';
import { IInterpreterAutoSelectionService } from '../../client/interpreter/autoSelection/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';

// tslint:disable-next-line:max-func-body-length
suite('Activation - ActivationManager', () => {
    class ExtensionActivationManagerTest extends ExtensionActivationManager {
        // tslint:disable-next-line:no-unnecessary-override
        public addHandlers() {
            return super.addHandlers();
        }
        // tslint:disable-next-line:no-unnecessary-override
        public async initialize() {
            return super.initialize();
        }
    }
    let managerTest: ExtensionActivationManagerTest;
    let workspaceService: IWorkspaceService;
    let appDiagnostics: IApplicationDiagnostics;
    let autoSelection: typemoq.IMock<IInterpreterAutoSelectionService>;
    let interpreterService: IInterpreterService;
    let documentManager: typemoq.IMock<IDocumentManager>;
    let activationService1: IExtensionActivationService;
    let activationService2: IExtensionActivationService;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        appDiagnostics = mock(ApplicationDiagnostics);
        autoSelection = typemoq.Mock.ofType<IInterpreterAutoSelectionService>();
        interpreterService = mock(InterpreterService);
        documentManager = typemoq.Mock.ofType<IDocumentManager>();
        activationService1 = mock(LanguageServerExtensionActivationService);
        activationService2 = mock(LanguageServerExtensionActivationService);
        managerTest = new ExtensionActivationManagerTest([instance(activationService1), instance(activationService2)],
            documentManager.object,
            instance(interpreterService),
            autoSelection.object,
            instance(appDiagnostics),
            instance(workspaceService));
    });
    test('Initialize will add event handlers and will dispose them when running dispose', async () => {
        const disposable = typemoq.Mock.ofType<IDisposable>();
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(() => disposable.object);

        when(workspaceService.workspaceFolders).thenReturn([]);
        when(interpreterService.getInterpreters(undefined)).thenResolve([]);
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined).verifiable(typemoq.Times.once());
        await managerTest.initialize();

        verify(workspaceService.onDidChangeWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).once();
        verify(interpreterService.getInterpreters(undefined)).once();

        documentManager.verifyAll();

        disposable.setup(d => d.dispose()).verifiable(typemoq.Times.once());

        managerTest.dispose();

        disposable.verifyAll();
    });
    test('Activate workspace specific to the resource in case of Multiple workspaces when a file is opened', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        let fileOpenedHandler!: (e: TextDocument) => Promise<void>;
        let workspaceFoldersChangedHandler!: Function;
        const documentUri = Uri.file('a');
        const document = typemoq.Mock.ofType<TextDocument>();
        document.setup(d => d.uri).returns(() => documentUri);

        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(cb => { workspaceFoldersChangedHandler = cb; return disposable1.object; });
        documentManager
            .setup(w => w.onDidOpenTextDocument(typemoq.It.isAny(), typemoq.It.isAny()))
            .callback(cb => (fileOpenedHandler = cb))
            .returns(() => disposable2.object)
            .verifiable(typemoq.Times.once());

        const resource = Uri.parse('two');
        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
        const folder2 = { name: 'two', uri: resource, index: 2 };
        when(workspaceService.workspaceFolders).thenReturn([folder1, folder2]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.getWorkspaceFolder(document.object.uri)).thenReturn(folder2);

        when(workspaceService.getWorkspaceFolder(resource)).thenReturn(folder2);
        when(activationService1.activate(resource)).thenResolve();
        when(activationService2.activate(resource)).thenResolve();
        autoSelection
            .setup(a => a.autoSelectInterpreter(resource))
            .returns(() => Promise.resolve());

        // Add workspaceFoldersChangedHandler
        await managerTest.addHandlers();
        expect(workspaceFoldersChangedHandler).not.to.be.equal(undefined, 'Handler not set');

        // Add fileOpenedHandler
        workspaceFoldersChangedHandler.call(managerTest);
        expect(fileOpenedHandler).not.to.be.equal(undefined, 'Handler not set');

        // Check if activate workspace is called on opening a file
        fileOpenedHandler.call(managerTest, document.object);

        documentManager.verifyAll();
        verify(workspaceService.onDidChangeWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).once();
        verify(workspaceService.getWorkspaceFolder(anything())).thrice();
        verify(activationService1.activate(folder2.uri)).once();
        verify(activationService2.activate(folder2.uri)).once();
    });
});
