// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { join as pathJoin } from 'path';
import { It as TypeMoqIt, Mock, MockBehavior } from 'typemoq';
import { getPythonVersion, parsePythonVersion } from '../../client/pythonEnvironments/pythonVersion';

interface IDeps {
    exec(cmd: string, args: string[]): Promise<{ stdout: string }>;
}

suite('parsePythonVersion()', () => {
    test('Must convert undefined if empty string', async () => {
        // tslint:disable-next-line: no-any
        assert.equal(parsePythonVersion(undefined as any), undefined);
        assert.equal(parsePythonVersion(''), undefined);
    });
    test('Must convert version correctly', async () => {
        const version = parsePythonVersion('3.7.1')!;
        assert.equal(version.raw, '3.7.1');
        assert.equal(version.major, 3);
        assert.equal(version.minor, 7);
        assert.equal(version.patch, 1);
        assert.deepEqual(version.prerelease, []);
    });
    test('Must convert version correctly with pre-release', async () => {
        const version = parsePythonVersion('3.7.1-alpha')!;
        assert.equal(version.raw, '3.7.1-alpha');
        assert.equal(version.major, 3);
        assert.equal(version.minor, 7);
        assert.equal(version.patch, 1);
        assert.deepEqual(version.prerelease, ['alpha']);
    });
    test('Must remove invalid pre-release channels', async () => {
        assert.deepEqual(parsePythonVersion('3.7.1-alpha')!.prerelease, ['alpha']);
        assert.deepEqual(parsePythonVersion('3.7.1-beta')!.prerelease, ['beta']);
        assert.deepEqual(parsePythonVersion('3.7.1-candidate')!.prerelease, ['candidate']);
        assert.deepEqual(parsePythonVersion('3.7.1-final')!.prerelease, ['final']);
        assert.deepEqual(parsePythonVersion('3.7.1-unknown')!.prerelease, []);
        assert.deepEqual(parsePythonVersion('3.7.1-')!.prerelease, []);
        assert.deepEqual(parsePythonVersion('3.7.1-prerelease')!.prerelease, []);
    });
    test('Must default versions partgs to 0 if they are not numeric', async () => {
        assert.deepEqual(parsePythonVersion('3.B.1')!.raw, '3.0.1');
        assert.deepEqual(parsePythonVersion('3.B.C')!.raw, '3.0.0');
        assert.deepEqual(parsePythonVersion('A.B.C')!.raw, '0.0.0');
    });
});

suite('getPythonVersion()', () => {
    test('Must return the Python Version', async () => {
        const pythonPath = pathJoin('a', 'b', 'python');
        const expected = 'Output from the Procecss';
        const mock = Mock.ofType<IDeps>(undefined, MockBehavior.Strict);
        mock.setup((p) => p.exec(TypeMoqIt.isValue(pythonPath), TypeMoqIt.isValue(['--version'])))
            // Fake the process stdout.
            .returns(() => Promise.resolve({ stdout: expected }));
        const exec = (c: string, a: string[]) => mock.object.exec(c, a);

        const pyVersion = await getPythonVersion(pythonPath, 'DEFAULT_TEST_VALUE', exec);

        assert.equal(pyVersion, expected, 'Incorrect version');
        mock.verifyAll();
    });

    test('Must return the default value when Python path is invalid', async () => {
        const pythonPath = pathJoin('a', 'b', 'python');
        const mock = Mock.ofType<IDeps>(undefined, MockBehavior.Strict);
        mock.setup((p) => p.exec(TypeMoqIt.isValue(pythonPath), TypeMoqIt.isValue(['--version'])))
            // Fake the process stdout.
            .returns(() => Promise.reject({}));
        const exec = (c: string, a: string[]) => mock.object.exec(c, a);

        const pyVersion = await getPythonVersion(pythonPath, 'DEFAULT_TEST_VALUE', exec);

        assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    });
});
