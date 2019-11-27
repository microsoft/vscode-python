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
import { IApplicationDiagnostics } from '../../client/application/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { IActiveResourceService, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import { IDisposable } from '../../client/common/types';
import { IInterpreterAutoSelectionService } from '../../client/interpreter/autoSelection/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { sleep } from '../core';

// tslint:disable:max-func-body-length no-any
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
        // tslint:disable-next-line:no-unnecessary-override
        public addRemoveDocOpenedHandlers() {
            super.addRemoveDocOpenedHandlers();
        }
    }
    let managerTest: ExtensionActivationManagerTest;
    let workspaceService: IWorkspaceService;
    let appDiagnostics: typemoq.IMock<IApplicationDiagnostics>;
    let autoSelection: typemoq.IMock<IInterpreterAutoSelectionService>;
    let interpreterService: IInterpreterService;
    let activeResourceService: IActiveResourceService;
    let documentManager: typemoq.IMock<IDocumentManager>;
    let activationService1: IExtensionActivationService;
    let activationService2: IExtensionActivationService;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        activeResourceService = mock(ActiveResourceService);
        appDiagnostics = typemoq.Mock.ofType<IApplicationDiagnostics>();
        autoSelection = typemoq.Mock.ofType<IInterpreterAutoSelectionService>();
        interpreterService = mock(InterpreterService);
        documentManager = typemoq.Mock.ofType<IDocumentManager>();
        activationService1 = mock(LanguageServerExtensionActivationService);
        activationService2 = mock(LanguageServerExtensionActivationService);
        managerTest = new ExtensionActivationManagerTest(
            [instance(activationService1), instance(activationService2)], [],
            documentManager.object,
            instance(interpreterService),
            autoSelection.object,
            appDiagnostics.object,
            instance(workspaceService),
            instance(activeResourceService)
        );
    });
    test('Initialize will add event handlers and will dispose them when running dispose', async () => {
        const disposable = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(() => disposable.object);
        when(workspaceService.workspaceFolders).thenReturn([1 as any, 2 as any]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        const eventDef = () => disposable2.object;
        documentManager.setup(d => d.onDidOpenTextDocument).returns(() => eventDef).verifiable(typemoq.Times.once());

        await managerTest.initialize();

        verify(workspaceService.workspaceFolders).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(workspaceService.onDidChangeWorkspaceFolders).once();

        documentManager.verifyAll();

        disposable.setup(d => d.dispose()).verifiable(typemoq.Times.once());
        disposable2.setup(d => d.dispose()).verifiable(typemoq.Times.once());

        managerTest.dispose();

        disposable.verifyAll();
        disposable2.verifyAll();
    });
    test('Remove text document opened handler if there is only one workspace', async () => {
        const disposable = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(() => disposable.object);
        when(workspaceService.workspaceFolders).thenReturn([1 as any, 2 as any]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        const eventDef = () => disposable2.object;
        documentManager.setup(d => d.onDidOpenTextDocument).returns(() => eventDef).verifiable(typemoq.Times.once());
        disposable.setup(d => d.dispose());
        disposable2.setup(d => d.dispose());

        await managerTest.initialize();

        verify(workspaceService.workspaceFolders).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(workspaceService.onDidChangeWorkspaceFolders).once();
        documentManager.verifyAll();
        disposable.verify(d => d.dispose(), typemoq.Times.never());
        disposable2.verify(d => d.dispose(), typemoq.Times.never());

        when(workspaceService.workspaceFolders).thenReturn([]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);

        await managerTest.initialize();

        verify(workspaceService.hasWorkspaceFolders).twice();
        disposable.verify(d => d.dispose(), typemoq.Times.never());
        disposable2.verify(d => d.dispose(), typemoq.Times.once());

        managerTest.dispose();

        disposable.verify(d => d.dispose(), typemoq.Times.atLeast(1));
        disposable2.verify(d => d.dispose(), typemoq.Times.once());
    });
    test('Activate workspace specific to the resource in case of Multiple workspaces when a file is opened', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        let fileOpenedHandler!: (e: TextDocument) => Promise<void>;
        let workspaceFoldersChangedHandler!: Function;
        const documentUri = Uri.file('a');
        const document = typemoq.Mock.ofType<TextDocument>();
        document.setup(d => d.uri).returns(() => documentUri);
        document.setup(d => d.languageId).returns(() => PYTHON_LANGUAGE);

        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(cb => {
            workspaceFoldersChangedHandler = cb;
            return disposable1.object;
        });
        documentManager
            .setup(w => w.onDidOpenTextDocument(typemoq.It.isAny(), typemoq.It.isAny()))
            .callback(cb => (fileOpenedHandler = cb))
            .returns(() => disposable2.object)
            .verifiable(typemoq.Times.once());

        const resource = Uri.parse('two');
        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
        const folder2 = { name: 'two', uri: resource, index: 2 };
        when(workspaceService.getWorkspaceFolderIdentifier(anything(), anything())).thenReturn('one');
        when(workspaceService.workspaceFolders).thenReturn([folder1, folder2]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.getWorkspaceFolder(document.object.uri)).thenReturn(folder2);

        when(workspaceService.getWorkspaceFolder(resource)).thenReturn(folder2);
        when(activationService1.activate(resource)).thenResolve();
        when(activationService2.activate(resource)).thenResolve();
        when(interpreterService.getInterpreters(anything())).thenResolve();
        autoSelection
            .setup(a => a.autoSelectInterpreter(resource))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        appDiagnostics
            .setup(a => a.performPreStartupHealthCheck(resource))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        // Add workspaceFoldersChangedHandler
        managerTest.addHandlers();
        expect(workspaceFoldersChangedHandler).not.to.be.equal(undefined, 'Handler not set');

        // Add fileOpenedHandler
        workspaceFoldersChangedHandler.call(managerTest);
        expect(fileOpenedHandler).not.to.be.equal(undefined, 'Handler not set');

        // Check if activate workspace is called on opening a file
        await fileOpenedHandler.call(managerTest, document.object);
        await sleep(1);

        documentManager.verifyAll();
        verify(workspaceService.onDidChangeWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).atLeast(1);
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(workspaceService.getWorkspaceFolder(anything())).atLeast(1);
        verify(activationService1.activate(resource)).once();
        verify(activationService2.activate(resource)).once();
    });
    test('Function activateWorkspace() will be filtered to current resource', async () => {
        const resource = Uri.parse('two');
        when(activationService1.activate(resource)).thenResolve();
        when(activationService2.activate(resource)).thenResolve();
        when(interpreterService.getInterpreters(anything())).thenResolve();
        autoSelection
            .setup(a => a.autoSelectInterpreter(resource))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        appDiagnostics
            .setup(a => a.performPreStartupHealthCheck(resource))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await managerTest.activateWorkspace(resource);

        verify(activationService1.activate(resource)).once();
        verify(activationService2.activate(resource)).once();
    });
    test('Handler docOpenedHandler is disposed in case no. of workspace folders decreases to one', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        let docOpenedHandler!: (e: TextDocument) => Promise<void>;
        let workspaceFoldersChangedHandler!: Function;
        const documentUri = Uri.file('a');
        const document = typemoq.Mock.ofType<TextDocument>();
        document.setup(d => d.uri).returns(() => documentUri);

        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(cb => { workspaceFoldersChangedHandler = cb; return disposable1.object; });
        documentManager
            .setup(w => w.onDidOpenTextDocument(typemoq.It.isAny(), typemoq.It.isAny()))
            .callback(cb => (docOpenedHandler = cb))
            .returns(() => disposable2.object)
            .verifiable(typemoq.Times.once());

        const resource = Uri.parse('two');
        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
        const folder2 = { name: 'two', uri: resource, index: 2 };
        when(workspaceService.workspaceFolders).thenReturn([folder1, folder2]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        // Add workspaceFoldersChangedHandler
        managerTest.addHandlers();
        expect(workspaceFoldersChangedHandler).not.to.be.equal(undefined, 'Handler not set');

        // Add docOpenedHandler
        workspaceFoldersChangedHandler.call(managerTest);
        expect(docOpenedHandler).not.to.be.equal(undefined, 'Handler not set');

        documentManager.verifyAll();
        verify(workspaceService.onDidChangeWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).atLeast(1);
        verify(workspaceService.hasWorkspaceFolders).once();

        //Removed no. of folders to one
        when(workspaceService.workspaceFolders).thenReturn([folder1]);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        disposable2.setup(d => d.dispose()).verifiable(typemoq.Times.once());

        workspaceFoldersChangedHandler.call(managerTest);

        verify(workspaceService.workspaceFolders).atLeast(1);
        verify(workspaceService.hasWorkspaceFolders).twice();
    });
});
