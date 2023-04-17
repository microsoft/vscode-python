// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { traceVerbose } from '../../../logging';
import { DataReceivedEvent, ExecutionTestPayload, ITestExecutionAdapter, ITestServer } from '../common/types';

/**
 * Wrapper Class for pytest test execution. This is where we call `runTestCommand`?
 */

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    private promiseMap: Map<string, Deferred<ExecutionTestPayload | undefined>> = new Map();

    private deferred: Deferred<ExecutionTestPayload> | undefined;

    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
    ) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ uuid, data }: DataReceivedEvent): void {
        const deferred = this.promiseMap.get(uuid);
        if (deferred) {
            deferred.resolve(JSON.parse(data));
            this.promiseMap.delete(uuid);
        }
    }

    // ** Old version of discover tests.
    async runTests(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
        traceVerbose(uri, testIds, debugBool);
        // TODO:Remove this line after enabling runs
        this.outputChannel.appendLine('Running tests.');
        this.deferred = createDeferred<ExecutionTestPayload>();
        return this.deferred.promise;
    }
}

//     public async runTests(
//         uri: Uri,
//         testIds: string[],
//         debugBool?: boolean,
//         executionFactory?: IPythonExecutionFactory,
//     ): Promise<ExecutionTestPayload> {
//         const deferred = createDeferred<ExecutionTestPayload>();
//         const relativePathToPytest = 'pythonFiles';
//         const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
//         this.configSettings.isTestExecution();
//         const uuid = this.testServer.createUUID(uri.fsPath);
//         this.promiseMap.set(uuid, deferred);
//         const settings = this.configSettings.getSettings(uri);
//         const { pytestArgs } = settings.testing;

//         const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
//         const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);

//         const spawnOptions: SpawnOptions = {
//             cwd: uri.fsPath,
//             throwOnStdErr: true,
//             extraVariables: {
//                 PYTHONPATH: pythonPathCommand,
//                 TEST_UUID: uuid.toString(),
//                 TEST_PORT: this.testServer.getPort().toString(),
//             },
//             outputChannel: this.outputChannel,
//         };

//         // Create the Python environment in which to execute the command.
//         const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
//             allowEnvironmentFetchExceptions: false,
//             resource: uri,
//         };
//         // need to check what will happen in the exec service is NOT defined and is null
//         const execService = await executionFactory?.createActivatedEnvironment(creationOptions);

//         const testIdsString = testIds.join(' ');
//         console.debug('what to do with debug bool?', debugBool);
//         try {
//             execService?.exec(['-m', 'pytest', '-p', 'vscode_pytest', testIdsString].concat(pytestArgs), spawnOptions);
//         } catch (ex) {
//             console.error(ex);
//         }

//         return deferred.promise;
//     }
// }

// function buildExecutionCommand(args: string[]): TestExecutionCommand {
//     const executionScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

//     return {
//         script: executionScript,
//         args: ['--udiscovery', ...args],
//     };
// }
