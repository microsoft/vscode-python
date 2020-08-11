import * as assert from 'assert';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import { ExecutionResult } from '../../../client/common/process/types';
import { Architecture } from '../../../client/common/utils/platform';
import * as ExternalDep from '../../../client/pythonEnvironments/common/externalDependencies';
import {
    EnvironmentInfoService,
    EnvironmentInfoServiceQueuePriority,
    EnvironmentType,
    IEnvironmentInfo,
    InterpreterType
} from '../../../client/pythonEnvironments/info/environmentInfoService';

suite('Environment Info Service', () => {
    let stubShellExec: sinon.SinonStub;
    setup(() => {
        stubShellExec = ImportMock.mockFunction(
            ExternalDep,
            'shellExecute',
            new Promise<ExecutionResult<string>>((resolve) => {
                resolve({
                    stdout:
                        '{"versionInfo": [3, 8, 3, "final", 0], "sysPrefix": "path", "version": "3.8.3 (tags/v3.8.3:6f8c832, May 13 2020, 22:37:02) [MSC v.1924 64 bit (AMD64)]", "is64Bit": true}'
                });
            })
        );
    });
    teardown(() => {
        stubShellExec.restore();
    });
    test('Add items to queue and get results', async () => {
        const envService = new EnvironmentInfoService();
        const promises: Promise<IEnvironmentInfo | undefined>[] = [];
        const expected: IEnvironmentInfo[] = [];
        for (let i: number = 0; i < 10; i = i + 1) {
            const path = `any-path${i}`;
            if (i < 5) {
                promises.push(envService.getEnvironmentInfo(path));
            } else {
                promises.push(envService.getEnvironmentInfo(path, EnvironmentInfoServiceQueuePriority.High));
            }
            expected.push({
                architecture: Architecture.x64,
                interpreterPath: path,
                interpreterType: InterpreterType.cpython,
                environmentType: EnvironmentType.Unknown,
                version: {
                    build: [],
                    major: 3,
                    minor: 8,
                    patch: 3,
                    prerelease: ['final'],
                    raw: '3.8.3-final'
                }
            });
        }

        await Promise.all(promises).then((r) => {
            // The order of items here is based on the order of the promises
            // The processing order is non-deterministic since we don't know
            // how long each work item will take
            assert.deepEqual(r, expected);
        });
    });
});
