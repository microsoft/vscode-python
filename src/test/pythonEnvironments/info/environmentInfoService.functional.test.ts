// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import { ExecutionResult } from '../../../client/common/process/types';
import { Architecture } from '../../../client/common/utils/platform';
import * as ExternalDep from '../../../client/pythonEnvironments/common/externalDependencies';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import {
    EnvironmentInfoService,
    EnvironmentInfoServiceQueuePriority,
} from '../../../client/pythonEnvironments/info/environmentInfoService';

suite('Environment Info Service', () => {
    let stubShellExec: sinon.SinonStub;

    function createExpectedEnvInfo(path: string): PythonEnvironment {
        return {
            path,
            architecture: Architecture.x64,
            sysVersion: undefined,
            sysPrefix: 'path',
            pipEnvWorkspaceFolder: undefined,
            version: {
                build: [],
                major: 3,
                minor: 8,
                patch: 3,
                prerelease: ['final'],
                raw: '3.8.3-final',
            },
            companyDisplayName: '',
            displayName: '',
            envType: EnvironmentType.Unknown,
            envName: '',
            envPath: '',
            cachedEntry: false,
        };
    }

    setup(() => {
        stubShellExec = ImportMock.mockFunction(
            ExternalDep,
            'shellExecute',
            new Promise<ExecutionResult<string>>((resolve) => {
                resolve({
                    stdout:
                        '{"versionInfo": [3, 8, 3, "final", 0], "sysPrefix": "path", "version": "3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]", "is64Bit": true}',
                });
            }),
        );
    });
    teardown(() => {
        stubShellExec.restore();
    });
    test('Add items to queue and get results', async () => {
        const envService = new EnvironmentInfoService();
        const promises: Promise<PythonEnvironment | undefined>[] = [];
        const expected: PythonEnvironment[] = [];
        for (let i = 0; i < 10; i = i + 1) {
            const path = `any-path${i}`;
            if (i < 5) {
                promises.push(envService.getEnvironmentInfo(path));
            } else {
                promises.push(envService.getEnvironmentInfo(path, EnvironmentInfoServiceQueuePriority.High));
            }
            expected.push(createExpectedEnvInfo(path));
        }

        await Promise.all(promises).then((r) => {
            // The processing order is non-deterministic since we don't know
            // how long each work item will take. So we compare here with
            // results of processing in the same order as we have collected
            // the promises.
            assert.deepEqual(r, expected);
        });
    });

    test('Add same item to queue', async () => {
        const envService = new EnvironmentInfoService();
        const promises: Promise<PythonEnvironment | undefined>[] = [];
        const expected: PythonEnvironment[] = [];

        const path = 'any-path';
        // Clear call counts
        stubShellExec.resetHistory();
        // Evaluate once so the result is cached.
        await envService.getEnvironmentInfo(path);

        for (let i = 0; i < 10; i = i + 1) {
            promises.push(envService.getEnvironmentInfo(path));
            expected.push(createExpectedEnvInfo(path));
        }

        await Promise.all(promises).then((r) => {
            assert.deepEqual(r, expected);
        });
        assert.ok(stubShellExec.calledOnce);
    });
});
