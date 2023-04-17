// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { Uri } from 'vscode';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { traceVerbose } from '../../../logging';
import { DataReceivedEvent, DiscoveredTestPayload, ITestDiscoveryAdapter, ITestServer } from '../common/types';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private promiseMap: Map<string, Deferred<DiscoveredTestPayload | undefined>> = new Map();

    private deferred: Deferred<DiscoveredTestPayload> | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
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
    discoverTests(uri: Uri): Promise<DiscoveredTestPayload> {
        traceVerbose(uri);
        this.deferred = createDeferred<DiscoveredTestPayload>();
        return this.deferred.promise;
    }
    // Uncomment this version of the function discoverTests to use the new discovery method.
    // public async discoverTests(uri: Uri, executionFactory: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
    //     const settings = this.configSettings.getSettings(uri);
    //     const { pytestArgs } = settings.testing;
    //     traceVerbose(pytestArgs);

    //     return this.runPytestDiscovery(uri, executionFactory);
    // }

    async runPytestDiscovery(uri: Uri, executionFactory: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
        const deferred = createDeferred<DiscoveredTestPayload>();
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        const uuid = this.testServer.createUUID(uri.fsPath);
        this.promiseMap.set(uuid, deferred);
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
        };

        // Create the Python environment in which to execute the command.
        const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
            allowEnvironmentFetchExceptions: false,
            resource: uri,
        };
        const execService = await executionFactory.createActivatedEnvironment(creationOptions);

        try {
            execService.exec(
                ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only'].concat(pytestArgs),
                spawnOptions,
            );
        } catch (ex) {
            console.error(ex);
        }
        return deferred.promise;
    }
}
