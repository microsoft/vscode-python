// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../../client/common/platform/types';
import { CondaExecutionService } from '../../../client/common/process/condaExecutionService';
import { IProcessService } from '../../../client/common/process/types';
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

    test('getExecutionInfo with a named environment should return execution info using the environment name', function() {
        // tslint:disable-next-line:no-invalid-this
        return this.skip();

        const environment = { name: 'foo', path: 'bar' };
        executionService = new CondaExecutionService(
            serviceContainer.object,
            processService.object,
            pythonPath,
            condaFile,
            environment
        );

        const result = executionService.getExecutionInfo(args);

        expect(result).to.deep.equal({ command: condaFile, args: ['run', '-n', environment.name, 'python', ...args] });
    });

    test('getExecutionInfo with a non-named environment should return execution info using the environment path', async function() {
        // tslint:disable-next-line:no-invalid-this
        return this.skip();

        const environment = { name: '', path: 'bar' };
        executionService = new CondaExecutionService(
            serviceContainer.object,
            processService.object,
            pythonPath,
            condaFile,
            environment
        );

        const result = executionService.getExecutionInfo(args);

        expect(result).to.deep.equal({ command: condaFile, args: ['run', '-p', environment.path, 'python', ...args] });
    });
});
