// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import '../../client/common/extensions';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../client/common/process/types';
import { IInterpreterVersionService } from '../../client/interpreter/contracts';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';

suite('Interpreters display version', () => {
    let pythonExecService: typeMoq.IMock<IPythonExecutionService>;
    let interpreterVersionService: IInterpreterVersionService;

    setup(() => {
        const pythonExecFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        pythonExecService = typeMoq.Mock.ofType<IPythonExecutionService>();
        // tslint:disable-next-line:no-any
        pythonExecService.setup((p: any) => p.then).returns(() => undefined);

        pythonExecFactory.setup(p => p.create({})).returns(() => Promise.resolve(pythonExecService.object));
        interpreterVersionService = new InterpreterVersionService(pythonExecFactory.object);
    });
    test('Must return the Python Version', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        const pythonVersion = 'Output from the Procecss';
        pythonExecService
            .setup(p => p.exec(typeMoq.It.isValue(['--version']), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pythonVersion }))
            .verifiable(typeMoq.Times.once());

        const pyVersion = await interpreterVersionService.getVersion(pythonPath, 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, pythonVersion, 'Incorrect version');
    });
    test('Must return the default value when Python path is invalid', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        pythonExecService
            .setup(p => p.exec(typeMoq.It.isValue(['--version']), typeMoq.It.isAny()))
            .returns(() => Promise.reject({}))
            .verifiable(typeMoq.Times.once());

        const pyVersion = await interpreterVersionService.getVersion(pythonPath, 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    });
    test('Must return the pip Version.', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        const pipVersion = '1.2.3';
        pythonExecService
            .setup(p => p.exec(typeMoq.It.isValue(['-m', 'pip', '--version']), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pipVersion }))
            .verifiable(typeMoq.Times.once());

        const pyVersion = await interpreterVersionService.getPipVersion(pythonPath);
        assert.equal(pyVersion, pipVersion, 'Incorrect version');
    });
    test('Must throw an exception when pip version cannot be determined', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        pythonExecService
            .setup(p => p.exec(typeMoq.It.isValue(['-m', 'pip', '--version']), typeMoq.It.isAny()))
            .returns(() => Promise.reject('error'))
            .verifiable(typeMoq.Times.once());

        const pipVersionPromise = interpreterVersionService.getPipVersion(pythonPath);
        await expect(pipVersionPromise).to.be.rejectedWith();
    });
});
