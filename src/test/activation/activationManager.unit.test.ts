// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { TextDocument, Uri } from 'vscode';
import { ExtensionActivationManager } from '../../client/activation/activationManager';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../../client/activation/types';
import { IApplicationDiagnostics } from '../../client/application/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { IActiveResourceService, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import { DeprecatePythonPath } from '../../client/common/experimentGroups';
import { ExperimentsManager } from '../../client/common/experiments';
import { InterpreterPathService } from '../../client/common/interpreterPathService';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { IDisposable, IExperimentsManager, IInterpreterPathService } from '../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../client/common/utils/async';
import { InterpreterSecurityService } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityService';
import {
    IInterpreterAutoSelectionService,
    IInterpreterSecurityService
} from '../../client/interpreter/autoSelection/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import * as EnvFileTelemetry from '../../client/telemetry/envFileTelemetry';
import { sleep } from '../core';

suite('Activation Manager', () => {
    // tslint:disable:max-func-body-length no-any
    suite('Language Server Activation - ActivationManager', () => {
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
        let interpreterSecurityService: IInterpreterSecurityService;
        let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
        let experiments: IExperimentsManager;
        let activationService1: IExtensionActivationService;
        let activationService2: IExtensionActivationService;
        let fileSystem: IFileSystem;
        setup(() => {
            interpreterSecurityService = mock(InterpreterSecurityService);
            experiments = mock(ExperimentsManager);
            interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
            workspaceService = mock(WorkspaceService);
            activeResourceService = mock(ActiveResourceService);
            appDiagnostics = typemoq.Mock.ofType<IApplicationDiagnostics>();
            autoSelection = typemoq.Mock.ofType<IInterpreterAutoSelectionService>();
            interpreterService = mock(InterpreterService);
            documentManager = typemoq.Mock.ofType<IDocumentManager>();
            activationService1 = mock(LanguageServerExtensionActivationService);
            activationService2 = mock(LanguageServerExtensionActivationService);
            fileSystem = mock(FileSystem);
            interpreterPathService
                .setup((i) => i.onDidChange(typemoq.It.isAny()))
                .returns(() => typemoq.Mock.ofType<IDisposable>().object);
            managerTest = new ExtensionActivationManagerTest(
                [instance(activationService1), instance(activationService2)],
                [],
                documentManager.object,
                instance(interpreterService),
                autoSelection.object,
                appDiagnostics.object,
                instance(workspaceService),
                instance(fileSystem),
                instance(activeResourceService),
                instance(experiments),
                interpreterPathService.object,
                instance(interpreterSecurityService)
            );

            sinon.stub(EnvFileTelemetry, 'sendActivationTelemetry').resolves();
            managerTest.evaluateAutoSelectedInterpreterSafety = () => Promise.resolve();
        });

        teardown(() => {
            sinon.restore();
        });

        test('Initialize will add event handlers and will dispose them when running dispose', async () => {
            const disposable = typemoq.Mock.ofType<IDisposable>();
            const disposable2 = typemoq.Mock.ofType<IDisposable>();
            when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(() => disposable.object);
            when(workspaceService.workspaceFolders).thenReturn([1 as any, 2 as any]);
            when(workspaceService.hasWorkspaceFolders).thenReturn(true);
            const eventDef = () => disposable2.object;
            documentManager
                .setup((d) => d.onDidOpenTextDocument)
                .returns(() => eventDef)
                .verifiable(typemoq.Times.once());

            await managerTest.initialize();

            verify(workspaceService.workspaceFolders).once();
            verify(workspaceService.hasWorkspaceFolders).once();
            verify(workspaceService.onDidChangeWorkspaceFolders).once();

            documentManager.verifyAll();

            disposable.setup((d) => d.dispose()).verifiable(typemoq.Times.once());
            disposable2.setup((d) => d.dispose()).verifiable(typemoq.Times.once());

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
            documentManager
                .setup((d) => d.onDidOpenTextDocument)
                .returns(() => eventDef)
                .verifiable(typemoq.Times.once());
            disposable.setup((d) => d.dispose());
            disposable2.setup((d) => d.dispose());

            await managerTest.initialize();

            verify(workspaceService.workspaceFolders).once();
            verify(workspaceService.hasWorkspaceFolders).once();
            verify(workspaceService.onDidChangeWorkspaceFolders).once();
            documentManager.verifyAll();
            disposable.verify((d) => d.dispose(), typemoq.Times.never());
            disposable2.verify((d) => d.dispose(), typemoq.Times.never());

            when(workspaceService.workspaceFolders).thenReturn([]);
            when(workspaceService.hasWorkspaceFolders).thenReturn(false);

            await managerTest.initialize();

            verify(workspaceService.hasWorkspaceFolders).twice();
            disposable.verify((d) => d.dispose(), typemoq.Times.never());
            disposable2.verify((d) => d.dispose(), typemoq.Times.once());

            managerTest.dispose();

            disposable.verify((d) => d.dispose(), typemoq.Times.atLeast(1));
            disposable2.verify((d) => d.dispose(), typemoq.Times.once());
        });
        test('Activate workspace specific to the resource in case of Multiple workspaces when a file is opened', async () => {
            const disposable1 = typemoq.Mock.ofType<IDisposable>();
            const disposable2 = typemoq.Mock.ofType<IDisposable>();
            let fileOpenedHandler!: (e: TextDocument) => Promise<void>;
            let workspaceFoldersChangedHandler!: Function;
            const documentUri = Uri.file('a');
            const document = typemoq.Mock.ofType<TextDocument>();
            document.setup((d) => d.uri).returns(() => documentUri);
            document.setup((d) => d.languageId).returns(() => PYTHON_LANGUAGE);

            when(workspaceService.onDidChangeWorkspaceFolders).thenReturn((cb) => {
                workspaceFoldersChangedHandler = cb;
                return disposable1.object;
            });
            documentManager
                .setup((w) => w.onDidOpenTextDocument(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((cb) => (fileOpenedHandler = cb))
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
            when(interpreterService.getInterpreters(anything(), anything())).thenResolve();
            autoSelection
                .setup((a) => a.autoSelectInterpreter(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            appDiagnostics
                .setup((a) => a.performPreStartupHealthCheck(resource))
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
            when(interpreterService.getInterpreters(anything(), anything())).thenResolve();
            autoSelection
                .setup((a) => a.autoSelectInterpreter(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            appDiagnostics
                .setup((a) => a.performPreStartupHealthCheck(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());

            await managerTest.activateWorkspace(resource);

            verify(activationService1.activate(resource)).once();
            verify(activationService2.activate(resource)).once();
        });

        test('If in Deprecate PythonPath experiment, method activateWorkspace() will copy old interpreter storage values to new', async () => {
            const resource = Uri.parse('two');
            when(activationService1.activate(resource)).thenResolve();
            when(activationService2.activate(resource)).thenResolve();
            when(interpreterService.getInterpreters(anything(), anything())).thenResolve();
            when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
            interpreterPathService
                .setup((i) => i.copyOldInterpreterStorageValuesToNew(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            autoSelection
                .setup((a) => a.autoSelectInterpreter(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            appDiagnostics
                .setup((a) => a.performPreStartupHealthCheck(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());

            await managerTest.activateWorkspace(resource);

            interpreterPathService.verifyAll();
            verify(activationService1.activate(resource)).once();
            verify(activationService2.activate(resource)).once();
        });

        test("The same workspace isn't activated more than once", async () => {
            const resource = Uri.parse('two');
            when(activationService1.activate(resource)).thenResolve();
            when(activationService2.activate(resource)).thenResolve();
            when(interpreterService.getInterpreters(anything(), anything())).thenResolve();
            autoSelection
                .setup((a) => a.autoSelectInterpreter(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            appDiagnostics
                .setup((a) => a.performPreStartupHealthCheck(resource))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());

            await managerTest.activateWorkspace(resource);
            await managerTest.activateWorkspace(resource);

            verify(activationService1.activate(resource)).once();
            verify(activationService2.activate(resource)).once();
            autoSelection.verifyAll();
            appDiagnostics.verifyAll();
        });

        test('If doc opened is not python, return', async () => {
            const doc = {
                uri: Uri.parse('doc'),
                languageId: 'NOT PYTHON'
            };

            managerTest.onDocOpened(doc as any);
            verify(workspaceService.getWorkspaceFolderIdentifier(doc.uri, anything())).never();
        });

        test('If we have opened a doc that does not belong to workspace, then do nothing', async () => {
            const doc = {
                uri: Uri.parse('doc'),
                languageId: PYTHON_LANGUAGE
            };
            when(workspaceService.getWorkspaceFolderIdentifier(doc.uri, anything())).thenReturn('');
            when(workspaceService.hasWorkspaceFolders).thenReturn(true);

            managerTest.onDocOpened(doc as any);

            verify(workspaceService.getWorkspaceFolderIdentifier(doc.uri, anything())).once();
            verify(workspaceService.getWorkspaceFolder(doc.uri)).never();
        });

        test('If workspace corresponding to the doc has already been activated, then do nothing', async () => {
            const doc = {
                uri: Uri.parse('doc'),
                languageId: PYTHON_LANGUAGE
            };
            when(workspaceService.getWorkspaceFolderIdentifier(doc.uri, anything())).thenReturn('key');
            managerTest.activatedWorkspaces.add('key');

            managerTest.onDocOpened(doc as any);

            verify(workspaceService.getWorkspaceFolderIdentifier(doc.uri, anything())).once();
            verify(workspaceService.getWorkspaceFolder(doc.uri)).never();
        });

        test('List of activated workspaces is updated & Handler docOpenedHandler is disposed in case no. of workspace folders decreases to one', async () => {
            const disposable1 = typemoq.Mock.ofType<IDisposable>();
            const disposable2 = typemoq.Mock.ofType<IDisposable>();
            let docOpenedHandler!: (e: TextDocument) => Promise<void>;
            let workspaceFoldersChangedHandler!: Function;
            const documentUri = Uri.file('a');
            const document = typemoq.Mock.ofType<TextDocument>();
            document.setup((d) => d.uri).returns(() => documentUri);

            when(workspaceService.onDidChangeWorkspaceFolders).thenReturn((cb) => {
                workspaceFoldersChangedHandler = cb;
                return disposable1.object;
            });
            documentManager
                .setup((w) => w.onDidOpenTextDocument(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((cb) => (docOpenedHandler = cb))
                .returns(() => disposable2.object)
                .verifiable(typemoq.Times.once());

            const resource = Uri.parse('two');
            const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
            const folder2 = { name: 'two', uri: resource, index: 2 };
            when(workspaceService.workspaceFolders).thenReturn([folder1, folder2]);

            when(workspaceService.getWorkspaceFolderIdentifier(folder1.uri, anything())).thenReturn('one');
            when(workspaceService.getWorkspaceFolderIdentifier(folder2.uri, anything())).thenReturn('two');
            // Assume the two workspaces are already activated, so their keys will be present in `activatedWorkspaces` set
            managerTest.activatedWorkspaces.add('one');
            managerTest.activatedWorkspaces.add('two');

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
            disposable2.setup((d) => d.dispose()).verifiable(typemoq.Times.once());

            workspaceFoldersChangedHandler.call(managerTest);

            verify(workspaceService.workspaceFolders).atLeast(1);
            verify(workspaceService.hasWorkspaceFolders).twice();
            disposable2.verifyAll();

            assert.deepEqual(Array.from(managerTest.activatedWorkspaces.keys()), ['one']);
        });
    });

    suite('Language Server Activation - activate()', () => {
        let workspaceService: IWorkspaceService;
        let appDiagnostics: typemoq.IMock<IApplicationDiagnostics>;
        let autoSelection: typemoq.IMock<IInterpreterAutoSelectionService>;
        let interpreterService: IInterpreterService;
        let activeResourceService: IActiveResourceService;
        let documentManager: typemoq.IMock<IDocumentManager>;
        let interpreterSecurityService: IInterpreterSecurityService;
        let activationService1: IExtensionActivationService;
        let activationService2: IExtensionActivationService;
        let fileSystem: IFileSystem;
        let singleActivationService: typemoq.IMock<IExtensionSingleActivationService>;
        let initialize: sinon.SinonStub<any>;
        let activateWorkspace: sinon.SinonStub<any>;
        let managerTest: ExtensionActivationManager;
        const resource = Uri.parse('a');
        let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
        let experiments: IExperimentsManager;

        setup(() => {
            interpreterSecurityService = mock(InterpreterSecurityService);
            experiments = mock(ExperimentsManager);
            workspaceService = mock(WorkspaceService);
            activeResourceService = mock(ActiveResourceService);
            appDiagnostics = typemoq.Mock.ofType<IApplicationDiagnostics>();
            autoSelection = typemoq.Mock.ofType<IInterpreterAutoSelectionService>();
            interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
            interpreterService = mock(InterpreterService);
            documentManager = typemoq.Mock.ofType<IDocumentManager>();
            activationService1 = mock(LanguageServerExtensionActivationService);
            activationService2 = mock(LanguageServerExtensionActivationService);
            fileSystem = mock(FileSystem);
            singleActivationService = typemoq.Mock.ofType<IExtensionSingleActivationService>();
            initialize = sinon.stub(ExtensionActivationManager.prototype, 'initialize');
            initialize.resolves();
            activateWorkspace = sinon.stub(ExtensionActivationManager.prototype, 'activateWorkspace');
            activateWorkspace.resolves();
            interpreterPathService
                .setup((i) => i.onDidChange(typemoq.It.isAny()))
                .returns(() => typemoq.Mock.ofType<IDisposable>().object);
            managerTest = new ExtensionActivationManager(
                [instance(activationService1), instance(activationService2)],
                [singleActivationService.object],
                documentManager.object,
                instance(interpreterService),
                autoSelection.object,
                appDiagnostics.object,
                instance(workspaceService),
                instance(fileSystem),
                instance(activeResourceService),
                instance(experiments),
                interpreterPathService.object,
                instance(interpreterSecurityService)
            );
            managerTest.evaluateAutoSelectedInterpreterSafety = () => Promise.resolve();
        });

        teardown(() => {
            sinon.restore();
        });

        test('Execution goes as expected if there are no errors', async () => {
            singleActivationService
                .setup((s) => s.activate())
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            autoSelection
                .setup((a) => a.autoSelectInterpreter(undefined))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            when(activeResourceService.getActiveResource()).thenReturn(resource);
            await managerTest.activate();
            assert.ok(initialize.calledOnce);
            assert.ok(activateWorkspace.calledOnce);
            singleActivationService.verifyAll();
            autoSelection.verifyAll();
        });

        test('Throws error if execution fails', async () => {
            singleActivationService
                .setup((s) => s.activate())
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            autoSelection
                .setup((a) => a.autoSelectInterpreter(undefined))
                .returns(() => Promise.reject(new Error('Kaboom')))
                .verifiable(typemoq.Times.once());
            when(activeResourceService.getActiveResource()).thenReturn(resource);
            const promise = managerTest.activate();
            await expect(promise).to.eventually.be.rejectedWith('Kaboom');
        });
    });

    suite('Selected Python Activation - evaluateIfAutoSelectedInterpreterIsSafe()', () => {
        let workspaceService: IWorkspaceService;
        let appDiagnostics: typemoq.IMock<IApplicationDiagnostics>;
        let autoSelection: typemoq.IMock<IInterpreterAutoSelectionService>;
        let interpreterService: IInterpreterService;
        let activeResourceService: IActiveResourceService;
        let documentManager: typemoq.IMock<IDocumentManager>;
        let activationService1: IExtensionActivationService;
        let activationService2: IExtensionActivationService;
        let fileSystem: IFileSystem;
        let managerTest: ExtensionActivationManager;
        const resource = Uri.parse('a');
        let interpreterSecurityService: IInterpreterSecurityService;
        let interpreterPathService: IInterpreterPathService;
        let experiments: IExperimentsManager;
        setup(() => {
            interpreterSecurityService = mock(InterpreterSecurityService);
            experiments = mock(ExperimentsManager);
            fileSystem = mock(FileSystem);
            interpreterPathService = mock(InterpreterPathService);
            workspaceService = mock(WorkspaceService);
            activeResourceService = mock(ActiveResourceService);
            appDiagnostics = typemoq.Mock.ofType<IApplicationDiagnostics>();
            autoSelection = typemoq.Mock.ofType<IInterpreterAutoSelectionService>();
            interpreterService = mock(InterpreterService);
            documentManager = typemoq.Mock.ofType<IDocumentManager>();
            activationService1 = mock(LanguageServerExtensionActivationService);
            activationService2 = mock(LanguageServerExtensionActivationService);
            when(experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control)).thenReturn(undefined);
            managerTest = new ExtensionActivationManager(
                [instance(activationService1), instance(activationService2)],
                [],
                documentManager.object,
                instance(interpreterService),
                autoSelection.object,
                appDiagnostics.object,
                instance(workspaceService),
                instance(fileSystem),
                instance(activeResourceService),
                instance(experiments),
                instance(interpreterPathService),
                instance(interpreterSecurityService)
            );
        });

        test(`If in Deprecate PythonPath experiment, and setting is not set, fetch autoselected interpreter but don't evaluate it if it equals 'undefined'`, async () => {
            const interpreter = undefined;
            when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
            when(workspaceService.getWorkspaceFolderIdentifier(resource)).thenReturn('1');
            autoSelection
                .setup((a) => a.getAutoSelectedInterpreter(resource))
                .returns(() => interpreter as any)
                .verifiable(typemoq.Times.once());
            when(interpreterPathService.get(resource)).thenReturn('python');
            when(
                interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)
            ).thenResolve();
            await managerTest.evaluateAutoSelectedInterpreterSafety(resource);
            autoSelection.verifyAll();
            verify(interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)).never();
        });

        ['', 'python'].forEach((setting) => {
            test(`If in Deprecate PythonPath experiment, and setting equals '${setting}', fetch autoselected interpreter and evaluate it`, async () => {
                const interpreter = { path: 'pythonPath' };
                when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
                when(workspaceService.getWorkspaceFolderIdentifier(resource)).thenReturn('1');
                autoSelection
                    .setup((a) => a.getAutoSelectedInterpreter(resource))
                    .returns(() => interpreter as any)
                    .verifiable(typemoq.Times.once());
                when(interpreterPathService.get(resource)).thenReturn(setting);
                when(
                    interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)
                ).thenResolve();
                await managerTest.evaluateAutoSelectedInterpreterSafety(resource);
                autoSelection.verifyAll();
                verify(
                    interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)
                ).once();
            });
        });

        test(`If in Deprecate PythonPath experiment, and setting is not set, fetch autoselected interpreter but don't evaluate it if it equals 'undefined'`, async () => {
            const interpreter = undefined;
            when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
            when(workspaceService.getWorkspaceFolderIdentifier(resource)).thenReturn('1');
            autoSelection
                .setup((a) => a.getAutoSelectedInterpreter(resource))
                .returns(() => interpreter as any)
                .verifiable(typemoq.Times.once());
            when(interpreterPathService.get(resource)).thenReturn('python');
            when(
                interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)
            ).thenResolve();
            await managerTest.evaluateAutoSelectedInterpreterSafety(resource);
            autoSelection.verifyAll();
            verify(interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)).never();
        });

        test(`If in Deprecate PythonPath experiment, and setting is set, simply return`, async () => {
            when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
            when(workspaceService.getWorkspaceFolderIdentifier(resource)).thenReturn('1');
            autoSelection.setup((a) => a.getAutoSelectedInterpreter(resource)).verifiable(typemoq.Times.never());
            when(interpreterPathService.get(resource)).thenReturn('settingSetToSomePath');
            await managerTest.evaluateAutoSelectedInterpreterSafety(resource);
            autoSelection.verifyAll();
        });

        test(`If in Deprecate PythonPath experiment, if setting is set during evaluation, don't wait for the evaluation to finish to resolve method promise`, async () => {
            const interpreter = { path: 'pythonPath' };
            const evaluateIfInterpreterIsSafeDeferred = createDeferred<void>();
            when(experiments.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
            when(workspaceService.getWorkspaceFolderIdentifier(resource)).thenReturn('1');
            autoSelection.setup((a) => a.getAutoSelectedInterpreter(resource)).returns(() => interpreter as any);
            when(interpreterPathService.get(resource)).thenReturn('python');
            when(
                interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource)
            ).thenReturn(evaluateIfInterpreterIsSafeDeferred.promise);
            const deferredPromise = createDeferredFromPromise(
                managerTest.evaluateAutoSelectedInterpreterSafety(resource)
            );
            expect(deferredPromise.completed).to.equal(false, 'Promise should not be resolved yet');
            reset(interpreterPathService);
            when(interpreterPathService.get(resource)).thenReturn('settingSetToSomePath');
            await managerTest.evaluateAutoSelectedInterpreterSafety(resource);
            await sleep(1);
            expect(deferredPromise.completed).to.equal(true, 'Promise should be resolved');
        });
    });
});
