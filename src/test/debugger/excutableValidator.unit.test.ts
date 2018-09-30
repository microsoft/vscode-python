// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { IFileSystem } from '../../client/common/platform/types';
import { ExecutionResult, IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { ExcutableValidator } from '../../client/debugger/executableValidator';
import { IServiceContainer } from '../../client/ioc/types';

suite('Debugger Executable Validator', () => {
    let fs: typeMoq.IMock<IFileSystem>;
    let processService: typeMoq.IMock<IProcessService>;
    let validator: ExcutableValidator;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        fs = typeMoq.Mock.ofType<IFileSystem>(undefined, typeMoq.MockBehavior.Strict);
        processService = typeMoq.Mock.ofType<IProcessService>();
        processService.setup((p: any) => p.then).returns(() => undefined);
        const processFactory = typeMoq.Mock.ofType<IProcessServiceFactory>();
        processFactory.setup(p => p.create()).returns(() => Promise.resolve(processService.object));

        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IProcessServiceFactory))).returns(() => processFactory.object);
        validator = new ExcutableValidator(serviceContainer.object);
    });

    async function validate(pythonPath: string, expectedResult: boolean, fileExists: boolean, processOutput: ExecutionResult<string>) {
        fs.setup(f => f.fileExists(typeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(fileExists));
        processService.setup(p => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['-c', 'print("1")'])))
            .returns(() => Promise.resolve(processOutput))
            .verifiable(typeMoq.Times.once());

        const isValid = await validator.validateExecutable(pythonPath);

        expect(isValid).to.be.equal(expectedResult, 'Incorrect value');
        fs.verifyAll();
        processService.verifyAll();
    }
    test('Validate \'python\' command', async () => {
        const pythonPath = 'python';
        const output = { stdout: '1' };
        await validate(pythonPath, true, false, output);
    });

    test('Validate \'python\' Executable with a valida path', async () => {
        const pythonPath = path.join('a', 'b', 'bin', 'python');
        const output = { stdout: '1' };
        await validate(pythonPath, true, true, output);
    });

    test('Validate \'spark-submit\'', async () => {
        const pythonPath = path.join('a', 'b', 'bin', 'spark-submit');
        const output = { stderr: 'ex', stdout: '' };
        await validate(pythonPath, true, true, output);
    });

    test('Validate invalid \'python\' command', async () => {
        const pythonPath = path.join('python');
        const output = { stderr: 'ex', stdout: '' };
        await validate(pythonPath, false, false, output);
    });

    test('Validate invalid executable', async () => {
        const pythonPath = path.join('a', 'b', 'bin', 'spark-submit');
        const output = { stderr: 'ex', stdout: '' };
        await validate(pythonPath, false, false, output);
    });
});
