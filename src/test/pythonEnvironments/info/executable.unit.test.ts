// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { StdErrError } from '../../../client/common/process/types';
import { buildPythonExecInfo } from '../../../client/pythonEnvironments/exec';
import * as sut from '../../../client/pythonEnvironments/info/executable';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';

const isolated = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'pythonFiles', 'pyvsc-run-isolated.py');

type ExecResult = {
    stdout: string;
};
interface IDeps {
    exec(command: string, args: string[]): Promise<ExecResult>;
}

suite('getExecutablePath()', () => {
    let deps: TypeMoq.IMock<IDeps>;
    const python = buildPythonExecInfo('path/to/python');

    setup(() => {
        deps = TypeMoq.Mock.ofType<IDeps>(undefined, TypeMoq.MockBehavior.Strict);
    });
    function verifyAll() {
        deps.verifyAll();
    }

    test('should get the value by running python', async () => {
        const expected = 'path/to/dummy/executable';
        const argv = [isolated, '-c', 'import sys;print(sys.executable)'];
        deps.setup((d) => d.exec(python.command, argv))
            .returns(() => Promise.resolve({ stdout: expected }));
        const exec = async (c: string, a: string[]) => deps.object.exec(c, a);

        const result = await sut.getExecutablePath(python, exec);

        expect(result).to.equal(expected, "getExecutablePath() sbould return get the value by running Python");
        verifyAll();
    });

    test('should throw if the result of exec() writes to stderr', async () => {
        const stderr = 'oops';
        const argv = [isolated, '-c', 'import sys;print(sys.executable)'];
        deps.setup((d) => d.exec(python.command, argv))
            .returns(() => Promise.reject(new StdErrError(stderr)));
        const exec = async (c: string, a: string[]) => deps.object.exec(c, a);

        const result = sut.getExecutablePath(python, exec);

        expect(result).to.eventually.be.rejectedWith(stderr);
        verifyAll();
    });
});
