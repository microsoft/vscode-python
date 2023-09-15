// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { Uri } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionResult,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import {
    DataReceivedEvent,
    DiscoveredTestPayload,
    ITestDiscoveryAdapter,
    ITestResultResolver,
    ITestServer,
} from '../common/types';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {}

    async discoverTests(uri: Uri, executionFactory?: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
        const uuid = this.testServer.createUUID(uri.fsPath);
        const deferredTillEOT: Deferred<void> = createDeferred<void>();
        const dataReceivedDisposable = this.testServer.onDiscoveryDataReceived(async (e: DataReceivedEvent) => {
            this.resultResolver?.resolveDiscovery(JSON.parse(e.data), deferredTillEOT);
        });
        const disposeDataReceiver = function (testServer: ITestServer) {
            traceInfo(`Disposing data receiver for ${uri.fsPath} and deleting UUID; pytest discovery.`);
            testServer.deleteUUID(uuid);
            dataReceivedDisposable.dispose();
        };
        try {
            await this.runPytestDiscovery(uri, uuid, executionFactory);
        } finally {
            await deferredTillEOT.promise;
            disposeDataReceiver(this.testServer);
        }
        // this is only a placeholder to handle function overloading until rewrite is finished
        const discoveryPayload: DiscoveredTestPayload = { cwd: uri.fsPath, status: 'success' };
        return discoveryPayload;
    }

    async runPytestDiscovery(uri: Uri, uuid: string, executionFactory?: IPythonExecutionFactory): Promise<void> {
        const deferred = createDeferred<DiscoveredTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

        const pythonPathParts: string[] = process.env.PYTHONPATH?.split(path.delimiter) ?? [];
        const pythonPathCommand = [fullPluginPath, ...pythonPathParts].join(path.delimiter);

        const spawnOptions: SpawnOptions = {
            cwd,
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
        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);
        // delete UUID following entire discovery finishing.
        const deferredExec = createDeferred<ExecutionResult<string>>();
        const execArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs);
        traceVerbose(`Running pytest discovery with command: ${execArgs.join(' ')}`);
        const result = execService?.execObservable(execArgs, spawnOptions);

        // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
        // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
        result?.proc?.stdout?.on('data', (data) => {
            spawnOptions.outputChannel?.append(data.toString());
        });
        result?.proc?.stderr?.on('data', (data) => {
            spawnOptions.outputChannel?.append(data.toString());
        });
        result?.proc?.on('exit', (code, signal) => {
            if (code !== 0) {
                traceError(
                    `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}. Creating and sending error discovery payload`,
                );
            }
            deferredExec.resolve({ stdout: '', stderr: '' });
            deferred.resolve();
        });

        await deferredExec.promise;
    }
}
