// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import '../../client/common/extensions';
import { IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { IInterpreterVersionService } from '../../client/interpreter/contracts';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';

const isolated = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'pythonFiles', 'pyvsc-run-isolated.py');

suite('InterpreterVersionService', () => {
    let processService: typeMoq.IMock<IProcessService>;
    let interpreterVersionService: IInterpreterVersionService;

    setup(() => {
        const processFactory = typeMoq.Mock.ofType<IProcessServiceFactory>();
        processService = typeMoq.Mock.ofType<IProcessService>();

        processService.setup((p: any) => p.then).returns(() => undefined);

        processFactory.setup((p) => p.create()).returns(() => Promise.resolve(processService.object));
        interpreterVersionService = new InterpreterVersionService(processFactory.object);
    });

    suite('getPipVersion', () => {
        test('Must return the pip Version.', async () => {
            const pythonPath = path.join('a', 'b', 'python');
            const pipVersion = '1.2.3';
            processService
                .setup((p) =>
                    p.exec(
                        typeMoq.It.isValue(pythonPath),
                        typeMoq.It.isValue([isolated, '-c', 'import pip; print(pip.__version__)']),
                        typeMoq.It.isAny(),
                    ),
                )
                .returns(() => Promise.resolve({ stdout: pipVersion }))
                .verifiable(typeMoq.Times.once());

            const pyVersion = await interpreterVersionService.getPipVersion(pythonPath);
            assert.equal(pyVersion, pipVersion, 'Incorrect version');
        });

        test('Must throw an exception when pip version cannot be determined', async () => {
            const pythonPath = path.join('a', 'b', 'python');
            processService
                .setup((p) =>
                    p.exec(
                        typeMoq.It.isValue(pythonPath),
                        typeMoq.It.isValue([isolated, '-c', 'import pip; print(pip.__version__)']),
                        typeMoq.It.isAny(),
                    ),
                )
                .returns(() => Promise.reject('error'))
                .verifiable(typeMoq.Times.once());

            const pipVersionPromise = interpreterVersionService.getPipVersion(pythonPath);
            await expect(pipVersionPromise).to.be.rejectedWith();
        });
    });
});
