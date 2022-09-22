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
import { DataReceivedEvent, DiscoveredTestPayload, ITestDiscoveryAdapter, ITestServer } from '../common/types';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private deferred: Deferred<DiscoveredTestPayload> | undefined;

    private cwd: string | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ cwd, data }: DataReceivedEvent): void {
        if (this.deferred && cwd === this.cwd) {
            const testData: DiscoveredTestPayload = JSON.parse(data);

            this.deferred.resolve(testData);
            this.deferred = undefined;
        }
    }

    public async discoverTests(uri: Uri, executionFactory: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { pytestArgs } = settings.testing;
        console.debug(pytestArgs); // do we use pytestArgs anywhere?

        this.cwd = uri.fsPath;
        return this.runPytestDiscovery(uri, executionFactory);
    }

    async runPytestDiscovery(uri: Uri, executionFactory: IPythonExecutionFactory): Promise<DiscoveredTestPayload> {
        if (!this.deferred) {
            this.deferred = createDeferred<DiscoveredTestPayload>();
            const relativePathToPytest = 'pythonFiles/pytest-vscode-integration';
            const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
            const uuid = this.testServer.createUUID(uri.fsPath);
            const settings = this.configSettings.getSettings(uri);
            const { pytestArgs } = settings.testing;
            const pythonPathCommand = `${fullPluginPath}${path.delimiter}`.concat(process.env.PYTHONPATH ?? '');

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
                execService.exec(['-m', 'pytest', '--collect-only', '--port', '500'].concat(pytestArgs), spawnOptions);
            } catch (ex) {
                console.error(ex);
            }
        }
        return this.deferred.promise;
    }
}

// function buildDiscoveryCommand(script: string, args: string[]): TestDiscoveryCommand {
//     const discoveryScript = script;

//     return {
//         script: discoveryScript,
//         args: [...args],
//     };
// }
