// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import {
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
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

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

        workspace.setup(x => x.getConfiguration('python', TypeMoq.It.isAny())).returns(() => config.object);
        serviceManager.addSingletonInstance<IInterpreterHelper>(IInterpreterHelper, helper.object);
        serviceManager.addSingletonInstance<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, updater.object);
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, locator.object, INTERPRETER_LOCATOR_SERVICE);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);

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
});
