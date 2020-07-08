// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { IPipEnvService } from '../../client/interpreter/contracts';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { IServiceContainer } from '../../client/ioc/types';

suite('Virtual environment manager', () => {
    const virtualEnvFolderName = 'virtual Env Folder Name';
    const pythonPath = path.join('a', 'b', virtualEnvFolderName, 'd', 'python');

    test('Plain Python environment suffix', async () => testSuffix(virtualEnvFolderName));
    test('Plain Python environment suffix with workspace Uri', async () =>
        testSuffix(virtualEnvFolderName, false, Uri.file(path.join('1', '2', '3', '4'))));
    test('Plain Python environment suffix with PipEnv', async () =>
        testSuffix('workspaceName', true, Uri.file(path.join('1', '2', '3', 'workspaceName'))));

    test('Use environment folder as env name', async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IPipEnvService)))
            .returns(() => TypeMoq.Mock.ofType<IPipEnvService>().object);
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);

        const venvManager = new VirtualEnvironmentManager(serviceContainer.object);
        const name = await venvManager.getEnvironmentName(pythonPath);

        expect(name).to.be.equal(virtualEnvFolderName);
    });

    test('Use workspace name as env name', async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const pipEnvService = TypeMoq.Mock.ofType<IPipEnvService>();
        pipEnvService
            .setup((p) => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IProcessServiceFactory)))
            .returns(() => TypeMoq.Mock.ofType<IProcessServiceFactory>().object);
        serviceContainer.setup((s) => s.get(TypeMoq.It.isValue(IPipEnvService))).returns(() => pipEnvService.object);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IFileSystem)))
            .returns(() => TypeMoq.Mock.ofType<IFileSystem>().object);
        const workspaceUri = Uri.file(path.join('root', 'sub', 'wkspace folder'));
        const workspaceFolder: WorkspaceFolder = { name: 'wkspace folder', index: 0, uri: workspaceUri };
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => true);
        workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);

        const venvManager = new VirtualEnvironmentManager(serviceContainer.object);
        const name = await venvManager.getEnvironmentName(pythonPath);

        expect(name).to.be.equal(path.basename(workspaceUri.fsPath));
        pipEnvService.verifyAll();
    });

    async function testSuffix(expectedEnvName: string, isPipEnvironment: boolean = false, resource?: Uri) {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IProcessServiceFactory)))
            .returns(() => TypeMoq.Mock.ofType<IProcessServiceFactory>().object);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IFileSystem)))
            .returns(() => TypeMoq.Mock.ofType<IFileSystem>().object);
        const pipEnvService = TypeMoq.Mock.ofType<IPipEnvService>();
        pipEnvService
            .setup((w) => w.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(isPipEnvironment));
        serviceContainer.setup((s) => s.get(TypeMoq.It.isValue(IPipEnvService))).returns(() => pipEnvService.object);
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService.setup((w) => w.hasWorkspaceFolders).returns(() => false);
        if (resource) {
            const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            workspaceFolder.setup((w) => w.uri).returns(() => resource);
            workspaceService
                .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isAny()))
                .returns(() => workspaceFolder.object);
        }
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);

        const venvManager = new VirtualEnvironmentManager(serviceContainer.object);

        const name = await venvManager.getEnvironmentName(pythonPath, resource);
        expect(name).to.be.equal(expectedEnvName, 'Virtual envrironment name suffix is incorrect.');
    }
});
