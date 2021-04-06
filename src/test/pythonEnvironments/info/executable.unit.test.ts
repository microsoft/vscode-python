// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { join as pathJoin } from 'path';
import { IMock, Mock, MockBehavior } from 'typemoq';
import { StdErrError } from '../../../client/common/process/types';
import { buildPythonExecInfo } from '../../../client/pythonEnvironments/exec';
import { getExecutablePath } from '../../../client/pythonEnvironments/info/executable';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';

const isolated = pathJoin(EXTENSION_ROOT_DIR_FOR_TESTS, 'pythonFiles', 'pyvsc-run-isolated.py');

type ExecResult = {
    stdout: string;
};
interface IDeps {
    exec(command: string, args: string[]): Promise<ExecResult>;
}

suite('getExecutablePath()', () => {
    let deps: IMock<IDeps>;
    const python = buildPythonExecInfo('path/to/python');

    setup(() => {
        deps = Mock.ofType<IDeps>(undefined, MockBehavior.Strict);
    });

    test('should get the value by running python', async () => {
        const expected = 'path/to/dummy/executable';
        const argv = [isolated, '-c', 'import sys;print(sys.executable)'];
        deps.setup((d) => d.exec(python.command, argv))
            // Return the expected value.
            .returns(() => Promise.resolve({ stdout: expected }));
        const exec = async (c: string, a: string[]) => deps.object.exec(c, a);

        const result = await getExecutablePath(python, exec);

        expect(result).to.equal(expected, 'getExecutablePath() should return get the value by running Python');
        deps.verifyAll();
    });

    test('should throw if exec() fails', async () => {
        const stderr = 'oops';
        const argv = [isolated, '-c', 'import sys;print(sys.executable)'];
        deps.setup((d) => d.exec(python.command, argv))
            // Throw an error.
            .returns(() => Promise.reject(new StdErrError(stderr)));
        const exec = async (c: string, a: string[]) => deps.object.exec(c, a);

        const result = getExecutablePath(python, exec);

        expect(result).to.eventually.be.rejectedWith(stderr);
        deps.verifyAll();
    });
});
