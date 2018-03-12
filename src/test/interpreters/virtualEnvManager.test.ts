// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { IBufferDecoder, IProcessService } from '../../client/common/process/types';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';

suite('Virtual environment manager', () => {
  let serviceManager: ServiceManager;
  let serviceContainer: ServiceContainer;
  let process: TypeMoq.IMock<IProcessService>;

  setup(async () => {
    const cont = new Container();
    serviceManager = new ServiceManager(cont);
    serviceContainer = new ServiceContainer(cont);
  });

  test('Plain Python environment suffix', async () => await testSuffix(''));
  test('Venv environment suffix', async () => await testSuffix('venv'));
  test('Virtualenv Python environment suffix', async () => await testSuffix('virtualenv'));

  test('Run actual virtual env detection code', async () => {
    serviceManager.addSingleton<IProcessService>(IProcessService, ProcessService);
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    const name = await venvManager.getEnvironmentName('python');
    const result = name === '' || name === 'venv' || name === 'virtualenv';
    expect(result).to.be.equal(true, 'Running venv detection code failed.');
  });

  async function testSuffix(expectedName: string) {
    process = TypeMoq.Mock.ofType<IProcessService>();
    serviceManager.addSingletonInstance<IProcessService>(IProcessService, process.object);

    const venvManager = new VirtualEnvironmentManager(serviceContainer);
    process
      .setup(x => x.exec('python', TypeMoq.It.isAny()))
      .returns(() => Promise.resolve({
        stdout: expectedName,
        stderr: ''
      }));

    const name = await venvManager.getEnvironmentName('python');
    expect(name).to.be.equal(expectedName, 'Virtual envrironment name suffix is incorrect.');
  }
});
