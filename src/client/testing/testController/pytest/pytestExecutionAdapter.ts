// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { traceVerbose } from '../../../logging';
import { DataReceivedEvent, ExecutionTestPayload, ITestExecutionAdapter, ITestServer } from '../common/types';

/**
 * Wrapper Class for pytest test execution. This is where we call `runTestCommand`?
 */

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    private deferred: Deferred<ExecutionTestPayload> | undefined;

    private cwd: string | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ cwd, data }: DataReceivedEvent): void {
        if (this.deferred && cwd === this.cwd) {
            const testData: ExecutionTestPayload = JSON.parse(data);

            this.deferred.resolve(testData);
            this.deferred = undefined;
        }
    }

    // ** Old version of discover tests.
    async runTests(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
        traceVerbose(uri, testIds, debugBool);
        this.deferred = createDeferred<ExecutionTestPayload>();
        return this.deferred.promise;
    }

    //     public async runTests(
    //         uri: Uri,
    //         testIds: string[],
    //         debugBool?: boolean,
    //         executionFactory?: IPythonExecutionFactory,
    //     ): Promise<ExecutionTestPayload> {
    //         if (!this.deferred) {
    //             this.deferred = createDeferred<ExecutionTestPayload>();
    //             const relativePathToPytest = 'pythonFiles';
    //             const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
    //             this.configSettings.isTestExecution();
    //             const uuid = this.testServer.createUUID(uri.fsPath);
    //             const settings = this.configSettings.getSettings(uri);
    //             const { pytestArgs } = settings.testing;

    //             const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
    //             const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);

    //             const spawnOptions: SpawnOptions = {
    //                 cwd: uri.fsPath,
    //                 throwOnStdErr: true,
    //                 extraVariables: {
    //                     PYTHONPATH: pythonPathCommand,
    //                     TEST_UUID: uuid.toString(),
    //                     TEST_PORT: this.testServer.getPort().toString(),
    //                 },
    //             };

    //             // Create the Python environment in which to execute the command.
    //             const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
    //                 allowEnvironmentFetchExceptions: false,
    //                 resource: uri,
    //             };
    //             // need to check what will happen in the exec service is NOT defined and is null
    //             const execService = await executionFactory?.createActivatedEnvironment(creationOptions);

    //             const testIdsString = testIds.join(' ');
    //             console.debug('what to do with debug bool?', debugBool);
    //             try {
    //                 execService?.exec(
    //                     ['-m', 'pytest', '-p', 'vscode_pytest', testIdsString].concat(pytestArgs),
    //                     spawnOptions,
    //                 );
    //             } catch (ex) {
    //                 console.error(ex);
    //             }
    //         }
    //         return this.deferred.promise;
    //     }
    // }

    // function buildExecutionCommand(args: string[]): TestExecutionCommand {
    //     const executionScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

    //     return {
    //         script: executionScript,
    //         args: ['--udiscovery', ...args],
    //     };
}
