// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import * as fileapis from '../../../../client/pythonEnvironments/common/externalDependencies';
import { isVenvEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/venvLocator';

suite('Venv Locator Tests', () => {
    suite('Venv identifier Tests', () => {
        const pyvenvCfg = 'pyvenv.cfg';
        const envRoot = path.join('path', 'to', 'env');
        const configPath = path.join('env', pyvenvCfg);
        let fileExistsStub:sinon.SinonStub;

        setup(() => {
            fileExistsStub = ImportMock.mockFunction(fileapis, 'pathExists');
        });

        teardown(() => {
            fileExistsStub.restore();
        });

        test('pyvenv.cfg does not exist', async () => {
            const interpreter = path.join(envRoot, 'python');
            fileExistsStub.callsFake(() => Promise.resolve(false));
            assert.ok(!(await isVenvEnvironment(interpreter)));
        });

        test('pyvenv.cfg exists in the current folder', async () => {
            const interpreter = path.join(envRoot, 'python');

            fileExistsStub.callsFake((p:string) => {
                if (p.endsWith(configPath)) {
                    return Promise.resolve(true);
                }
                return Promise.resolve(false);
            });

            assert.ok(await isVenvEnvironment(interpreter));
        });

        test('pyvenv.cfg exists in the parent folder', async () => {
            const interpreter = path.join(envRoot, 'bin', 'python');

            fileExistsStub.callsFake((p:string) => {
                if (p.endsWith(configPath)) {
                    return Promise.resolve(true);
                }
                return Promise.resolve(false);
            });

            assert.ok(await isVenvEnvironment(interpreter));
        });
    });
});
