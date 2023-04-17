// /* eslint-disable @typescript-eslint/no-explicit-any */
// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.
// import * as assert from 'assert';
// import { Uri } from 'vscode';
// import * as typeMoq from 'typemoq';
// import { IConfigurationService } from '../../../../client/common/types';
// import { PytestTestDiscoveryAdapter } from '../../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
// import { DataReceivedEvent, ITestServer } from '../../../../client/testing/testController/common/types';
// import { IPythonExecutionFactory, IPythonExecutionService } from '../../../../client/common/process/types';
// import { createDeferred, Deferred } from '../../../../client/common/utils/async';

// suite('pytest test discovery adapter', () => {
//     let testServer: typeMoq.IMock<ITestServer>;
//     let configService: IConfigurationService;
//     let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
//     let adapter: PytestTestDiscoveryAdapter;
//     let execService: typeMoq.IMock<IPythonExecutionService>;
//     let deferred: Deferred<void>;
//     setup(() => {
//         testServer = typeMoq.Mock.ofType<ITestServer>();
//         testServer.setup((t) => t.getPort()).returns(() => 12345);
//         testServer
//             .setup((t) => t.onDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
//             .returns(() => ({
//                 dispose: () => {
//                     /* no-body */
//                 },
//             }));
//         configService = ({
//             getSettings: () => ({
//                 testing: { pytestArgs: ['.'] },
//             }),
//         } as unknown) as IConfigurationService;
//         execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
//         execService = typeMoq.Mock.ofType<IPythonExecutionService>();
//         execFactory
//             .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
//             .returns(() => Promise.resolve(execService.object));
//         deferred = createDeferred();
//         execService
//             .setup((x) => x.exec(typeMoq.It.isAny(), typeMoq.It.isAny()))
//             .returns(() => {
//                 deferred.resolve();
//                 return Promise.resolve({ stdout: '{}' });
//             });
//         execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
//         execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
//     });
//     test('onDataReceivedHandler should parse only if known UUID', async () => {
//         const uri = Uri.file('/my/test/path/');
//         const uuid = 'uuid123';
//         const data = { status: 'success' };
//         testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
//         const eventData: DataReceivedEvent = {
//             uuid,
//             data: JSON.stringify(data),
//         };

//         adapter = new PytestTestDiscoveryAdapter(testServer.object, configService);
//         // ** const promise = adapter.discoverTests(uri, execFactory.object);
//         const promise = adapter.discoverTests(uri);
//         await deferred.promise;
//         adapter.onDataReceivedHandler(eventData);
//         const result = await promise;
//         assert.deepStrictEqual(result, data);
//     });
//     test('onDataReceivedHandler should not parse if it is unknown UUID', async () => {
//         const uri = Uri.file('/my/test/path/');
//         const uuid = 'uuid456';
//         let data = { status: 'error' };
//         testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
//         const wrongUriEventData: DataReceivedEvent = {
//             uuid: 'incorrect-uuid456',
//             data: JSON.stringify(data),
//         };
//         adapter = new PytestTestDiscoveryAdapter(testServer.object, configService);
//         // ** const promise = adapter.discoverTests(uri, execFactory.object);
//         const promise = adapter.discoverTests(uri);
//         adapter.onDataReceivedHandler(wrongUriEventData);

//         data = { status: 'success' };
//         const correctUriEventData: DataReceivedEvent = {
//             uuid,
//             data: JSON.stringify(data),
//         };
//         adapter.onDataReceivedHandler(correctUriEventData);
//         const result = await promise;
//         assert.deepStrictEqual(result, data);
//     });
// });
