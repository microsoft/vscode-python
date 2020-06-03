// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import * as sut from '../../../client/pythonEnvironments/discovery/info';

interface IDeps {
    exec(cmd: string, args: string[]): Promise<{ stdout: string }>;
}

suite('getPythonVersion', () => {
    test('Must return the Python Version', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        const expected = 'Output from the Procecss';
        const mock = typeMoq.Mock.ofType<IDeps>(undefined, typeMoq.MockBehavior.Strict);
        mock.setup((p) => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['--version'])))
            // Fake the process stdout.
            .returns(() => Promise.resolve({ stdout: expected }));
        const exec = (c: string, a: string[]) => mock.object.exec(c, a);

        const pyVersion = await sut.getPythonVersion(pythonPath, 'DEFAULT_TEST_VALUE', exec);

        assert.equal(pyVersion, expected, 'Incorrect version');
        mock.verifyAll();
    });

    test('Must return the default value when Python path is invalid', async () => {
        const pythonPath = path.join('a', 'b', 'python');
        const mock = typeMoq.Mock.ofType<IDeps>(undefined, typeMoq.MockBehavior.Strict);
        mock.setup((p) => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['--version'])))
            // Fake the process stdout.
            .returns(() => Promise.reject({}));
        const exec = (c: string, a: string[]) => mock.object.exec(c, a);

        const pyVersion = await sut.getPythonVersion(pythonPath, 'DEFAULT_TEST_VALUE', exec);

        assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    });
});
