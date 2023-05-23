// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { Uri } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { traceError, traceVerbose } from '../../../logging';
import { DataReceivedEvent, DiscoveredTestPayload, ITestDiscoveryAdapter, ITestServer } from '../common/types';
import { ITestResultResolver } from '../common/resultResolver';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver, // is readonly the right type??
    ) {
        // testServer.onDiscoveryDataReceived(this.onDiscoveryDataReceivedHandler, this);
    }

    // public onDiscoveryDataReceivedHandler({ data }: DataReceivedEvent): void {
    //     this.resultResolver?.resolveDiscovery(JSON.parse(data));
    // }

    async discoverTests(
        uri: Uri,
        isMultiroot?: boolean,
        executionFactory?: IPythonExecutionFactory,
    ): Promise<DiscoveredTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;
        traceVerbose(pytestArgs);
        const disposable = this.testServer.onDiscoveryDataReceived((e: DataReceivedEvent) => {
            if (isMultiroot !== undefined) {
                this.resultResolver?.resolveDiscovery(JSON.parse(e.data), isMultiroot);
            }
        });
        try {
            await this.runPytestDiscovery(uri, executionFactory);
        } finally {
            disposable.dispose();
            // confirm with testing that this gets called (it must clean this up)
        }
        const discoveryPayload: DiscoveredTestPayload = { cwd: uri.fsPath, status: 'success' };
        return discoveryPayload;
    }

    async runPytestDiscovery(uri: Uri, executionFactory?: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
        const deferred = createDeferred<DiscoveredTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
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

        const execService = await executionFactory?.createActivatedEnvironment(creationOptions);
        execService
            ?.exec(['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs), spawnOptions)
            .then(() => {
                this.testServer.deleteUUID(uuid);
                return deferred.resolve();
            })
            .catch((err) => {
                traceError(`Error while trying to run pytest discovery, \n${err}\r\n\r\n`);
                this.testServer.deleteUUID(uuid);
                return deferred.reject(err);
            });

        return deferred.promise;
    }
}
