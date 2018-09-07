// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { expect } from 'chai';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
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
import { PYTHON_PATH } from '../common';

suite('Virtual environment manager', () => {
  let serviceManager: ServiceManager;
  let serviceContainer: ServiceContainer;

  setup(async () => {
    const cont = new Container();
    serviceManager = new ServiceManager(cont);
    serviceContainer = new ServiceContainer(cont);
  });

  test('Plain Python environment suffix', async () => testSuffix(''));
  test('Venv environment suffix', async () => testSuffix('venv'));
  test('Virtualenv Python environment suffix', async () => testSuffix('virtualenv'));

  test('Run actual virtual env detection code', async () => {
    const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
    processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(new ProcessService(new BufferDecoder(), process.env as any)));
    serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingletonInstance<IPipEnvService>(IPipEnvService, TypeMoq.Mock.ofType<IPipEnvService>().object);
    serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, TypeMoq.Mock.ofType<IWorkspaceService>().object);
    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    const name = await venvManager.getEnvironmentName(PYTHON_PATH);
    const result = name === '' || name === 'venv' || name === 'virtualenv';
    expect(result).to.be.equal(true, 'Running venv detection code failed.');
  });

  async function testSuffix(expectedName: string) {
    const processService = TypeMoq.Mock.ofType<IProcessService>();
    const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
    processService.setup((x: any) => x.then).returns(() => undefined);
    processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
    serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
    serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, TypeMoq.Mock.ofType<IFileSystem>().object);
    serviceManager.addSingletonInstance<IPipEnvService>(IPipEnvService, TypeMoq.Mock.ofType<IPipEnvService>().object);
    serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, TypeMoq.Mock.ofType<IWorkspaceService>().object);

    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    processService
      .setup(x => x.exec(PYTHON_PATH, TypeMoq.It.isAny()))
      .returns(() => Promise.resolve({
        stdout: expectedName,
        stderr: ''
      }));

    const name = await venvManager.getEnvironmentName(PYTHON_PATH);
    expect(name).to.be.equal(expectedName, 'Virtual envrironment name suffix is incorrect.');
  }
});
