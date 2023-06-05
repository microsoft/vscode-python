// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// import * as assert from 'assert';
// import * as path from 'path';
// import * as typemoq from 'typemoq';
// import { Uri } from 'vscode';
// import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
// import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
// import { ITestServer, TestCommandOptions } from '../../../../client/testing/testController/common/types';
// import { UnittestTestExecutionAdapter } from '../../../../client/testing/testController/unittest/testExecutionAdapter';

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

//         const uri = Uri.file('/foo/bar');
//         const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

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

//         const adapter = new UnittestTestExecutionAdapter(stubTestServer, stubConfigSettings, outputChannel.object);

//         // triggers runTests flow which will run onDataReceivedHandler and the
//         // promise resolves into the parsed data.
//         const promise = adapter.runTests(uri, [], false);

//         adapter.onDataReceivedHandler({ uuid, data: JSON.stringify(data) });

//         const result = await promise;

//         assert.deepStrictEqual(result, data);
//     });
//     test("onDataReceivedHandler should ignore the data if the cwd from the payload does not match the test adapter's cwd", async () => {
//         const correctUuid = '123456789';
//         const incorrectUuid = '987654321';
//         const stubTestServer = ({
//             sendCommand(): Promise<void> {
//                 return Promise.resolve();
//             },
//             onDataReceived: () => {
//                 // no body
//             },
//             createUUID: () => correctUuid,
//         } as unknown) as ITestServer;

//         const uri = Uri.file('/foo/bar');

//         const adapter = new UnittestTestExecutionAdapter(stubTestServer, stubConfigSettings, outputChannel.object);

//         // triggers runTests flow which will run onDataReceivedHandler and the
//         // promise resolves into the parsed data.
//         const promise = adapter.runTests(uri, [], false);

//         const data = { status: 'success' };
//         // will not resolve due to incorrect UUID
//         adapter.onDataReceivedHandler({ uuid: incorrectUuid, data: JSON.stringify(data) });

//         const nextData = { status: 'error' };
//         // will resolve and nextData will be returned as result
//         adapter.onDataReceivedHandler({ uuid: correctUuid, data: JSON.stringify(nextData) });

//         const result = await promise;

//         assert.deepStrictEqual(result, nextData);
//     });
// });
