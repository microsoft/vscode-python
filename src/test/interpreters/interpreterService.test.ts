// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { EventEmitter } from 'events';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, TextDocument, TextEditor, Uri, WorkspaceConfiguration } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { noop } from '../../client/common/core.utils';
import { Architecture, IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, IDisposableRegistry } from '../../client/common/types';
import { IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorService,
    INTERPRETER_LOCATOR_SERVICE,
    InterpreterType,
    PIPENV_SERVICE,
    PythonInterpreter,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
    WorkspacePythonPath
} from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};

// tslint:disable-next-line:max-func-body-length
suite('Interpreters service', () => {
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;
    let updater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let helper: TypeMoq.IMock<IInterpreterHelper>;
    let locator: TypeMoq.IMock<IInterpreterLocatorService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;
    let pipenvLocator: TypeMoq.IMock<IInterpreterLocatorService>;
    let wksLocator: TypeMoq.IMock<IInterpreterLocatorService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let interpreterDisplay: TypeMoq.IMock<IInterpreterDisplay>;

    setup(async () => {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        updater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        helper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        locator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();

        workspace.setup(x => x.getConfiguration('python', TypeMoq.It.isAny())).returns(() => config.object);
        serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, []);
        serviceManager.addSingletonInstance<IInterpreterHelper>(IInterpreterHelper, helper.object);
        serviceManager.addSingletonInstance<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, updater.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, locator.object, INTERPRETER_LOCATOR_SERVICE);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);

        pipenvLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        wksLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
    });

    test('autoset interpreter - no workspace', async () => {
        await verifyUpdateCalled(TypeMoq.Times.never());
    });

    test('autoset interpreter - global pythonPath in config', async () => {
        setupWorkspace('folder');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python', globalValue: 'global' };
        });
        await verifyUpdateCalled(TypeMoq.Times.never());
    });

    test('autoset interpreter - workspace has no pythonPath in config', async () => {
        setupWorkspace('folder');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python' };
        });
        const interpreter: PythonInterpreter = {
            ...info,
            path: path.join(path.sep, 'folder', 'py1', 'bin', 'python.exe'),
            type: InterpreterType.Unknown
        };
        setupLocators([interpreter], []);
        await verifyUpdateCalled(TypeMoq.Times.once());
    });

    test('autoset interpreter - workspace has default pythonPath in config', async () => {
        setupWorkspace('folder');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python', workspaceValue: 'python' };
        });
        setupLocators([], []);
        await verifyUpdateCalled(TypeMoq.Times.never());
    });

    test('autoset interpreter - pipenv workspace', async () => {
        setupWorkspace('folder');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python', workspaceValue: 'python' };
        });
        const interpreter: PythonInterpreter = {
            ...info,
            path: 'python',
            type: InterpreterType.VirtualEnv
        };
        setupLocators([], [interpreter]);
        await verifyUpdateCallData('python', ConfigurationTarget.Workspace, 'folder');
    });

    test('autoset interpreter - workspace without interpreter', async () => {
        setupWorkspace('root');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python', workspaceValue: 'elsewhere' };
        });
        const interpreter: PythonInterpreter = {
            ...info,
            path: 'elsewhere',
            type: InterpreterType.Unknown
        };

        setupLocators([interpreter], []);
        await verifyUpdateCalled(TypeMoq.Times.never());
    });

    test('autoset interpreter - workspace with interpreter', async () => {
        setupWorkspace('root');
        config.setup(x => x.inspect('pythonPath')).returns(() => {
            return { key: 'python' };
        });
        const intPath = path.join(path.sep, 'root', 'under', 'bin', 'python.exe');
        const interpreter: PythonInterpreter = {
            ...info,
            path: intPath,
            type: InterpreterType.Unknown
        };

        setupLocators([interpreter], []);
        await verifyUpdateCallData(intPath, ConfigurationTarget.Workspace, 'root');
    });

    async function verifyUpdateCalled(times: TypeMoq.Times) {
        const service = new InterpreterService(serviceContainer);
        await service.autoSetInterpreter();
        updater
            .verify(x => x.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), times);
    }

    async function verifyUpdateCallData(pythonPath: string, target: ConfigurationTarget, wksFolder: string) {
        let pp: string | undefined;
        let confTarget: ConfigurationTarget | undefined;
        let trigger;
        let wks;
        updater
            .setup(x => x.updatePythonPath(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            // tslint:disable-next-line:no-any
            .callback((p: string, c: ConfigurationTarget, t: any, w: any) => {
                pp = p;
                confTarget = c;
                trigger = t;
                wks = w;
            })
            .returns(() => Promise.resolve());

        const service = new InterpreterService(serviceContainer);
        await service.autoSetInterpreter();

        expect(pp).not.to.be.equal(undefined, 'updatePythonPath not called');
        expect(pp!).to.be.equal(pythonPath, 'invalid Python path');
        expect(confTarget).to.be.equal(target, 'invalid configuration target');
        expect(trigger).to.be.equal('load', 'invalid trigger');
        expect(wks.fsPath).to.be.equal(`${path.sep}${wksFolder}`, 'invalid workspace Uri');
    }

    function setupWorkspace(folder: string) {
        const wsPath: WorkspacePythonPath = {
            folderUri: Uri.file(folder),
            configTarget: ConfigurationTarget.Workspace
        };
        helper.setup(x => x.getActiveWorkspaceUri()).returns(() => wsPath);
    }

    function setupLocators(wks: PythonInterpreter[], pipenv: PythonInterpreter[]) {
        pipenvLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(pipenv));
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, pipenvLocator.object, PIPENV_SERVICE);
        wksLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(wks));
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, wksLocator.object, WORKSPACE_VIRTUAL_ENV_SERVICE);

    }

    test('Changes to active document should invoke intrepreter.refresh method', async () => {
        const service = new InterpreterService(serviceContainer);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

        let activeTextEditorChangeHandler: Function | undefined;
        documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            activeTextEditorChangeHandler = handler;
            return { dispose: noop };
        });
        serviceManager.addSingletonInstance(IConfigurationService, configService.object);
        serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

        // tslint:disable-next-line:no-any
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new EventEmitter() as any);
        service.initialize();
        const textEditor = TypeMoq.Mock.ofType<TextEditor>();
        const uri = Uri.file(path.join('usr', 'file.py'));
        const document = TypeMoq.Mock.ofType<TextDocument>();
        textEditor.setup(t => t.document).returns(() => document.object);
        document.setup(d => d.uri).returns(() => uri);
        activeTextEditorChangeHandler!(textEditor.object);

        interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(uri)), TypeMoq.Times.once());
    });

    test('If there is no active document then intrepreter.refresh should not be invoked', async () => {
        const service = new InterpreterService(serviceContainer);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

        let activeTextEditorChangeHandler: Function | undefined;
        documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            activeTextEditorChangeHandler = handler;
            return { dispose: noop };
        });
        serviceManager.addSingletonInstance(IConfigurationService, configService.object);
        serviceManager.addSingletonInstance(IDocumentManager, documentManager.object);

        // tslint:disable-next-line:no-any
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new EventEmitter() as any);
        service.initialize();
        activeTextEditorChangeHandler!();

        interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(undefined)), TypeMoq.Times.never());
    });
    [undefined, Uri.file('some workspace')]
        .forEach(resource => {
            test(`Ensure undefined is returned if we're unable to retrieve interpreter info (Resource is ${resource})`, async () => {
                const pythonPath = 'SOME VALUE';
                const service = new InterpreterService(serviceContainer);
                locator
                    .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                    .returns(() => Promise.resolve([]))
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getInterpreterInformation(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                const virtualEnvMgr = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
                serviceManager.addSingletonInstance(IVirtualEnvironmentManager, virtualEnvMgr.object);
                virtualEnvMgr
                    .setup(v => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(''))
                    .verifiable(TypeMoq.Times.once());
                virtualEnvMgr
                    .setup(v => v.getEnvironmentType(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(InterpreterType.Unknown))
                    .verifiable(TypeMoq.Times.once());

                const details = await service.getInterpreterDetails(pythonPath, resource);

                locator.verifyAll();
                helper.verifyAll();
                expect(details).to.be.equal(undefined, 'Not undefined');
            });
        });
});
