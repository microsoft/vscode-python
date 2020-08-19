// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import { identifyEnvironment } from '../../../client/pythonEnvironments/common/environmentIdentifier';
import { EnvironmentType } from '../../../client/pythonEnvironments/info';

suite('Environment Identifier', () => {
    const testLayoutsRoot = path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'src',
        'test',
        'pythonEnvironments',
        'common',
        'envlayouts'
    );
    test('Conda layout with conda-meta and python binary in the same directory', async () => {
        const interpreterPath: string = path.join(testLayoutsRoot, 'conda1', 'python.exe');
        const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
        assert.deepEqual(envType, EnvironmentType.Conda);
    });
    test('Conda layout with conda-meta and python binary in a sub directory', async () => {
        const interpreterPath: string = path.join(testLayoutsRoot, 'conda2', 'bin', 'python');
        const envType: EnvironmentType = await identifyEnvironment(interpreterPath);
        assert.deepEqual(envType, EnvironmentType.Conda);
    });
});
