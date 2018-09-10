// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { expect } from 'chai';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PlatformService } from '../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { IBufferDecoder, IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { IPipEnvService } from '../../client/interpreter/contracts';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

suite('Virtual environment manager', () => {
  let serviceManager: ServiceManager;
  let serviceContainer: ServiceContainer;
  const virtualEnvFolderName = 'virtual Env Folder Name';
  const pythonPath = path.join('a', 'b', virtualEnvFolderName, 'd', 'python');
  setup(async () => {
    const cont = new Container();
    serviceManager = new ServiceManager(cont);
    serviceContainer = new ServiceContainer(cont);
  });

  test('Plain Python environment suffix', async () => testSuffix('', ''));
  test('Plain Python environment suffix with workspace Uri', async () => testSuffix('', '', false, Uri.file(path.join('1', '2', '3', '4'))));
  test('Plain Python environment suffix with PipEnv', async () => testSuffix('', 'workspaceName', true, Uri.file(path.join('1', '2', '3', 'workspaceName'))));
  test('Venv environment suffix', async () => testSuffix('venv', 'venv'));
  test('Virtualenv Python environment suffix', async () => testSuffix('virtualenv', virtualEnvFolderName));

  test('Run actual virtual env detection code', async () => {
    const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
    processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(new ProcessService(new BufferDecoder(), process.env as any)));
    serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingletonInstance<IPipEnvService>(IPipEnvService, TypeMoq.Mock.ofType<IPipEnvService>().object);
    const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
    workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
    serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);
    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    const name = await venvManager.getEnvironmentName(pythonPath);
    const result = name === '' || name === 'venv' || name === 'virtualenv';
    expect(result).to.be.equal(true, 'Running venv detection code failed.');
  });

  async function testSuffix(virtualEnvProcOutput: string, expectedEnvName: string, isPipEnvironment: boolean = false, resource?: Uri) {
    const processService = TypeMoq.Mock.ofType<IProcessService>();
    const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
    processService.setup((x: any) => x.then).returns(() => undefined);
    processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
    serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
    serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, TypeMoq.Mock.ofType<IFileSystem>().object);
    const pipEnvService = TypeMoq.Mock.ofType<IPipEnvService>();
    pipEnvService.setup(w => w.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(isPipEnvironment));
    serviceManager.addSingletonInstance<IPipEnvService>(IPipEnvService, pipEnvService.object);
    const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
    workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
    if (resource) {
      const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
      workspaceFolder.setup(w => w.uri).returns(() => resource);
      workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
    }
    serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);

    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    processService
      .setup(x => x.exec(pythonPath, TypeMoq.It.isAny()))
      .returns(() => Promise.resolve({
        stdout: virtualEnvProcOutput,
        stderr: ''
      }));

    const name = await venvManager.getEnvironmentName(pythonPath, resource);
    expect(name).to.be.equal(expectedEnvName, 'Virtual envrironment name suffix is incorrect.');
  }
});
