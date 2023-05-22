// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri } from 'vscode';
import * as path from 'path';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { traceError, traceVerbose } from '../../../logging';
import { DataReceivedEvent, ExecutionTestPayload, ITestExecutionAdapter, ITestServer } from '../common/types';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { removePositionalFoldersAndFiles } from './arguments';
import { ITestResultResolver } from '../common/resultResolver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).EXTENSION_ROOT_DIR = EXTENSION_ROOT_DIR;
/**
 * Wrapper Class for pytest test execution. This is where we call `runTestCommand`?
 */

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    private runInstance!: TestRun;

    public onDataReceivedHandler({ data }: DataReceivedEvent): void {
        this.resultResolver?.resolveRun(JSON.parse(data), this.runInstance);
    }

    async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
        runInstance?: TestRun,
    ): Promise<ExecutionTestPayload> {
        this.runInstance = runInstance!;
        traceVerbose(uri, testIds, debugBool);
        return this.runTestsNew(uri, testIds, debugBool, executionFactory);
    }

    private async runTestsNew(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
    ): Promise<ExecutionTestPayload> {
        const deferred = createDeferred<ExecutionTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        this.configSettings.isTestExecution();
        const uuid = this.testServer.createUUID(uri.fsPath);
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;

        const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);

        const spawnOptions: SpawnOptions = {
            cwd: uri.fsPath,
            throwOnStdErr: true,
            extraVariables: {
                PYTHONPATH: pythonPathCommand,
                TEST_UUID: uuid.toString(),
                TEST_PORT: this.testServer.getPort().toString(),
            },
            outputChannel: this.outputChannel,
        };

        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: uri,
        };
        // need to check what will happen in the exec service is NOT defined and is null
        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);

        try {
            // Remove positional test folders and files, we will add as needed per node
            const testArgs = removePositionalFoldersAndFiles(pytestArgs);

            // if user has provided `--rootdir` then use that, otherwise add `cwd`
            if (testArgs.filter((a) => a.startsWith('--rootdir')).length === 0) {
                // Make sure root dir is set so pytest can find the relative paths
                testArgs.splice(0, 0, '--rootdir', uri.fsPath);
            }

            if (debugBool && !testArgs.some((a) => a.startsWith('--capture') || a === '-s')) {
                testArgs.push('--capture', 'no');
            }

            const argArray = ['-m', 'pytest', '-p', 'vscode_pytest'].concat(testArgs).concat(testIds);

            console.debug(`Running test with arguments: ${argArray.join(' ')}\r\n`);
            console.debug(`Current working directory: ${uri.fsPath}\r\n`);

            execService
                ?.exec(argArray, spawnOptions)
                .then(() => {
                    this.testServer.deleteUUID(uuid);
                    deferred.resolve();
                })
                .catch((err) => {
                    traceError(`Error while running tests: ${testIds}\r\n${err}\r\n\r\n`);
                    this.testServer.deleteUUID(uuid);
                    deferred.reject(err);
                });
        } catch (ex) {
            console.debug(`Error while running tests: ${testIds}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        }

        return deferred.promise;
    }
}
