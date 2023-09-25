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
import { traceError, traceInfo, traceLog, traceVerbose } from '../../../logging';
import {
    DataReceivedEvent,
    DiscoveredTestPayload,
    ITestDiscoveryAdapter,
    ITestResultResolver,
    ITestServer,
} from '../common/types';
import { createDiscoveryErrorPayload, createEOTPayload, fixLogLines } from '../common/utils';

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

        let execArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs);
        // filter out color=yes from pytestArgs
        execArgs = execArgs.filter((item) => item !== '--color=yes');
        traceVerbose(`Running pytest discovery with command: ${execArgs.join(' ')}`);
        const result = execService?.execObservable(execArgs, spawnOptions);

        // Take all output from the subprocess and add it to the test output channel. This will be the pytest output.
        // Displays output to user and ensure the subprocess doesn't run into buffer overflow.
        // TODO: after a release, remove discovery output from the "Python Test Log" channel and send it to the "Python" channel instead.

        let collectedOutput = '';
        result?.proc?.stdout?.on('data', (data) => {
            const out = fixLogLines(data.toString());
            collectedOutput += out;
        });
        result?.proc?.stderr?.on('data', (data) => {
            const out = fixLogLines(data.toString());
            collectedOutput += out;
            traceError(out);
            spawnOptions?.outputChannel?.append(`${out}`);
        });
        result?.proc?.on('exit', (code, signal) => {
            // Collect all discovery output and log it at process finish to avoid dividing it between log lines.
            traceLog(`\r\n${collectedOutput}`);
            spawnOptions?.outputChannel?.append(`${collectedOutput}`);
            this.outputChannel?.append(
                'Starting now, all test run output will be sent to the Test Result panel' +
                    ' and test discovery output will be sent to the "Python" output channel instead of the "Python Test Log" channel.' +
                    ' The "Python Test Log" channel will be deprecated within the next month. See ___ for details.',
            );
            if (code !== 0) {
                traceError(
                    `Subprocess exited unsuccessfully with exit code ${code} and signal ${signal}. Creating and sending error discovery payload`,
                );
                // if the child process exited with a non-zero exit code, then we need to send the error payload.
                this.testServer.triggerDiscoveryDataReceivedEvent({
                    uuid,
                    data: JSON.stringify(createDiscoveryErrorPayload(code, signal, cwd)),
                });
                // then send a EOT payload
                this.testServer.triggerDiscoveryDataReceivedEvent({
                    uuid,
                    data: JSON.stringify(createEOTPayload(true)),
                });
            }
            deferredExec.resolve({
                stdout: '',
                stderr: '',
            });
            deferred.resolve();
        });

        await deferredExec.promise;
    }
}
