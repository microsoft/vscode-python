// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../../client/common/platform/types';
import { CondaExecutionService } from '../../../client/common/process/condaExecutionService';
import { IProcessService } from '../../../client/common/process/types';
import { CondaEnvironmentInfo } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

suite('CondaExecutionService', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let processService: TypeMoq.IMock<IProcessService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let executionService: CondaExecutionService;
    const args = ['-a', 'b', '-c'];
    const pythonPath = 'path/to/python';
    const condaFile = 'path/to/conda';

    setup(() => {
        processService = TypeMoq.Mock.ofType<IProcessService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);

        serviceContainer.setup(s => s.get<IFileSystem>(IFileSystem)).returns(() => fileSystem.object);
    });

    async function testExecutionService(environment: CondaEnvironmentInfo, expectedCommand: string, expectedArgs: string[]): Promise<void> {
        const expectedExecResult = { stdout: 'foo' };

        processService.setup(p => p.exec(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), {})).returns(() => Promise.resolve(expectedExecResult));

        executionService = new CondaExecutionService(serviceContainer.object, processService.object, pythonPath, condaFile, environment);

        const executableInfo = await executionService.exec(args, {});

        expect(executableInfo).to.be.equal(expectedExecResult);
        processService.verify(p => p.exec(expectedCommand, expectedArgs, {}), TypeMoq.Times.once());
    }

    test('getExecutableInfo with a named environment should return an executable command using the environment name', async () => {
        const environment = { name: 'foo', path: 'bar' };
        await testExecutionService(environment, condaFile, ['run', '-n', environment.name, 'python', ...args]);
    });

    test('getExecutableInfo with a non-named environment should return an executable command using the environment npathame', async () => {
        const environment = { name: '', path: 'bar' };
        await testExecutionService(environment, condaFile, ['run', '-p', environment.path, 'python', ...args]);
    });

    test('getExecutableInfo with an environment without a name or a prefix should return an executable command using pythonPath', async () => {
        const environment = { name: '', path: '' };
        await testExecutionService(environment, pythonPath, args);
    });
});
