// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { IProcessService } from '../../client/common/process/types';
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

    process = TypeMoq.Mock.ofType<IProcessService>();
    serviceManager.addSingletonInstance<IProcessService>(IProcessService, process.object);
  });

  test('Plain Python environment suffix', async () => await testSuffix(''));
  test('Venv environment suffix', async () => await testSuffix('venv'));
  test('Virtualenv Python environment suffix', async () => await testSuffix('virtualenv'));

  async function testSuffix(expectedName: string) {
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
