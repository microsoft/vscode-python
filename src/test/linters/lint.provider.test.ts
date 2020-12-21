// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { LanguageServerType } from '../../client/activation/types';
import { IApplicationShell, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IFileSystem } from '../../client/common/platform/types';
import {
    GLOBAL_MEMENTO,
    IConfigurationService,
    IInstaller,
    ILintingSettings,
    IMemento,
    IPersistentStateFactory,
    IPythonSettings,
    Product,
    WORKSPACE_MEMENTO,
} from '../../client/common/types';
import { createDeferred } from '../../client/common/utils/async';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService,
} from '../../client/interpreter/autoSelection/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { AvailableLinterActivator } from '../../client/linters/linterAvailability';
import { LinterManager } from '../../client/linters/linterManager';
import { IAvailableLinterActivator, ILinterManager, ILintingEngine } from '../../client/linters/types';
import { LinterProvider } from '../../client/providers/linterProvider';
import { initialize } from '../initialize';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { MockMemento } from '../mocks/mementos';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Provider', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let engine: TypeMoq.IMock<ILintingEngine>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let docManager: TypeMoq.IMock<IDocumentManager>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let lm: ILinterManager;
    let serviceContainer: ServiceContainer;
    let emitter: vscode.EventEmitter<vscode.TextDocument>;
    let document: TypeMoq.IMock<vscode.TextDocument>;
    let fs: TypeMoq.IMock<IFileSystem>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let linterInstaller: TypeMoq.IMock<IInstaller>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let workspaceConfig: TypeMoq.IMock<vscode.WorkspaceConfiguration>;

    suiteSetup(initialize);
    setup(async () => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);

        serviceContainer = new ServiceContainer(cont);

        fs = TypeMoq.Mock.ofType<IFileSystem>();
        fs.setup((x) => x.fileExists(TypeMoq.It.isAny())).returns(
            () => new Promise<boolean>((resolve, _reject) => resolve(true)),
        );
        fs.setup((x) => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fs.object);

        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);

        engine = TypeMoq.Mock.ofType<ILintingEngine>();
        serviceManager.addSingletonInstance<ILintingEngine>(ILintingEngine, engine.object);

        docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, docManager.object);

        const lintSettings = TypeMoq.Mock.ofType<ILintingSettings>();
        lintSettings.setup((x) => x.enabled).returns(() => true);
        lintSettings.setup((x) => x.lintOnSave).returns(() => true);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup((x) => x.linting).returns(() => lintSettings.object);
        settings.setup((p) => p.languageServer).returns(() => LanguageServerType.Jedi);

        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configService.object);

        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        linterInstaller = TypeMoq.Mock.ofType<IInstaller>();

        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceConfig = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
        workspaceService
            .setup((w) => w.getConfiguration('python', TypeMoq.It.isAny()))
            .returns(() => workspaceConfig.object);
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);

        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        serviceManager.addSingletonInstance<IInstaller>(IInstaller, linterInstaller.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);
        serviceManager.add(IAvailableLinterActivator, AvailableLinterActivator);
        serviceManager.addSingleton<IInterpreterAutoSelectionService>(
            IInterpreterAutoSelectionService,
            MockAutoSelectionService,
        );
        serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(
            IInterpreterAutoSeletionProxyService,
            MockAutoSelectionService,
        );
        serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        serviceManager.addSingleton<vscode.Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        serviceManager.addSingleton<vscode.Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);
        lm = new LinterManager(serviceContainer, workspaceService.object);
        serviceManager.addSingletonInstance<ILinterManager>(ILinterManager, lm);
        emitter = new vscode.EventEmitter<vscode.TextDocument>();
        document = TypeMoq.Mock.ofType<vscode.TextDocument>();
    });

    test('Lint on open file', async () => {
        docManager.setup((x) => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup((x) => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup((x) => x.languageId).returns(() => 'python');

        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        emitter.fire(document.object);
        engine.verify((x) => x.lintDocument(document.object, 'auto'), TypeMoq.Times.once());
    });

    test('Lint on save file', async () => {
        docManager.setup((x) => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup((x) => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup((x) => x.languageId).returns(() => 'python');

        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        emitter.fire(document.object);
        engine.verify((x) => x.lintDocument(document.object, 'save'), TypeMoq.Times.once());
    });

    test('No lint on open other files', async () => {
        docManager.setup((x) => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup((x) => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup((x) => x.languageId).returns(() => 'csharp');

        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        emitter.fire(document.object);
        engine.verify((x) => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });

    test('No lint on save other files', async () => {
        docManager.setup((x) => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup((x) => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup((x) => x.languageId).returns(() => 'csharp');

        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        emitter.fire(document.object);
        engine.verify((x) => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });

    test('Lint on change interpreters', async () => {
        const e = new vscode.EventEmitter<void>();
        interpreterService.setup((x) => x.onDidChangeInterpreter).returns(() => e.event);

        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        e.fire();
        engine.verify((x) => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    });

    test('Lint on save pylintrc', async () => {
        docManager.setup((x) => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup((x) => x.uri).returns(() => vscode.Uri.file('.pylintrc'));

        await lm.setActiveLintersAsync([Product.pylint]);
        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();
        emitter.fire(document.object);

        const deferred = createDeferred<void>();
        setTimeout(() => deferred.resolve(), 2000);
        await deferred.promise;
        engine.verify((x) => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    });

    test('Diagnostic cleared on file close', async () => testClearDiagnosticsOnClose(true));
    test('Diagnostic not cleared on file opened in another tab', async () => testClearDiagnosticsOnClose(false));

    async function testClearDiagnosticsOnClose(closed: boolean) {
        docManager.setup((x) => x.onDidCloseTextDocument).returns(() => emitter.event);

        const uri = vscode.Uri.file('test.py');
        document.setup((x) => x.uri).returns(() => uri);
        document.setup((x) => x.isClosed).returns(() => closed);

        docManager.setup((x) => x.textDocuments).returns(() => (closed ? [] : [document.object]));
        const linterProvider = new LinterProvider(serviceContainer);
        await linterProvider.activate();

        emitter.fire(document.object);
        const timesExpected = closed ? TypeMoq.Times.once() : TypeMoq.Times.never();
        engine.verify((x) => x.clearDiagnostics(TypeMoq.It.isAny()), timesExpected);
    }
});
