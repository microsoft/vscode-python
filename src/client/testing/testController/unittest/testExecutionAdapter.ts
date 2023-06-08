// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

import * as path from 'path';
import { TestRun, Uri } from 'vscode';
import * as net from 'net';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    ITestServer,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';
import { traceLog, traceError } from '../../../logging';
import { startTestIdServer } from '../common/utils';

// suite('Unittest test execution adapter', () => {
//     let stubConfigSettings: IConfigurationService;
//     let outputChannel: typemoq.IMock<ITestOutputChannel>;

//     setup(() => {
//         stubConfigSettings = ({
//             getSettings: () => ({
//                 testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
//             }),
//         } as unknown) as IConfigurationService;
//         outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
//     });

//     test('runTests should send the run command to the test server', async () => {
//         let options: TestCommandOptions | undefined;

//         const stubTestServer = ({
//             sendCommand(opt: TestCommandOptions, runTestIdPort?: string): Promise<void> {
//                 delete opt.outChannel;
//                 options = opt;
//                 assert(runTestIdPort !== undefined);
//                 return Promise.resolve();
//             },
//             onDataReceived: () => {
//                 // no body
//             },
//             createUUID: () => '123456789',
//         } as unknown) as ITestServer;

    public async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
    ): Promise<ExecutionTestPayload> {
        const disposable = this.testServer.onRunDataReceived((e: DataReceivedEvent) => {
            if (runInstance) {
                this.resultResolver?.resolveExecution(JSON.parse(e.data), runInstance);
            }
        });
        try {
            await this.runTestsNew(uri, testIds, debugBool);
        } finally {
            disposable.dispose();
            // confirm with testing that this gets called (it must clean this up)
        }
        const executionPayload: ExecutionTestPayload = { cwd: uri.fsPath, status: 'success', error: '' };
        return executionPayload;
    }

    private async runTestsNew(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;

//         const adapter = new UnittestTestExecutionAdapter(stubTestServer, stubConfigSettings, outputChannel.object);
//         adapter.runTests(uri, [], false).then(() => {
//             const expectedOptions: TestCommandOptions = {
//                 workspaceFolder: uri,
//                 command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
//                 cwd: uri.fsPath,
//                 uuid: '123456789',
//                 debugBool: false,
//                 testIds: [],
//             };
//             assert.deepStrictEqual(options, expectedOptions);
//         });
//     });
//     test("onDataReceivedHandler should parse the data if the cwd from the payload matches the test adapter's cwd", async () => {
//         const stubTestServer = ({
//             sendCommand(): Promise<void> {
//                 return Promise.resolve();
//             },
//             onDataReceived: () => {
//                 // no body
//             },
//             createUUID: () => '123456789',
//         } as unknown) as ITestServer;

//         const uri = Uri.file('/foo/bar');
//         const data = { status: 'success' };
//         const uuid = '123456789';

        const deferred = createDeferred<ExecutionTestPayload>();
        this.promiseMap.set(uuid, deferred);
        traceLog(`Running UNITTEST execution for the following test ids: ${testIds}`);

        let runTestIdsPort: string | undefined;
        await startTestIdServer(testIds)
            .then((assignedPort) => {
                traceLog(`Server started and listening on port ${assignedPort}`);
                runTestIdsPort = assignedPort.toString();
                // Send test command to server.
                // Server fire onDataReceived event once it gets response.
            })
            .catch((error) => {
                traceError('Error starting server:', error);
            });

        await this.testServer.sendCommand(options, runTestIdsPort, () => {
            // disposable.dispose();
            deferred.resolve();
        });
        // return deferred.promise;
        const executionPayload: ExecutionTestPayload = { cwd: uri.fsPath, status: 'success', error: '' };
        return executionPayload;
    }
}

//         const nextData = { status: 'error' };
//         // will resolve and nextData will be returned as result
//         adapter.onDataReceivedHandler({ uuid: correctUuid, data: JSON.stringify(nextData) });

//         const result = await promise;

//         assert.deepStrictEqual(result, nextData);
//     });
// });
