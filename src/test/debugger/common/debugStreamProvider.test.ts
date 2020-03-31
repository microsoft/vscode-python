// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as getFreePort from 'get-port';
import * as net from 'net';
import * as TypeMoq from 'typemoq';
import { ICurrentProcess } from '../../../client/common/types';
import { DebugStreamProvider } from '../../../client/debugger/debugAdapter/Common/debugStreamProvider';
import { IDebugStreamProvider } from '../../../client/debugger/debugAdapter/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../common';

// tslint:disable-next-line:max-func-body-length
suite('Debugging - Stream Provider', () => {
    let streamProvider: IDebugStreamProvider;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        streamProvider = new DebugStreamProvider(serviceContainer.object);
    });
    test('Process is returned as is if there is no port number if args', async () => {
        const mockProcess = { argv: [], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => mockProcess);

        const streams = await streamProvider.getInputAndOutputStreams();
        expect(streams.input).to.be.equal(mockProcess.stdin);
        expect(streams.output).to.be.equal(mockProcess.stdout);
    });
    test('Starts a socketserver on the port provided and returns the client socket', async () => {
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--server=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => mockProcess);

        const streamsPromise = streamProvider.getInputAndOutputStreams();
        await sleep(1);

        await new Promise<net.Socket>((resolve) => {
            net.connect({ port, host: 'localhost' }, resolve);
        });

        const streams = await streamsPromise;
        expect(streams.input).to.not.be.equal(mockProcess.stdin);
        expect(streams.output).to.not.be.equal(mockProcess.stdout);
    });
    test('Ensure existence of port is identified', async () => {
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--server=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => mockProcess);

        expect(streamProvider.useDebugSocketStream).to.be.equal(true, 'incorrect');
    });
    test('Ensure non-existence of port is identified', async () => {
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const mockProcess = { argv: ['node', 'index.js', `--other=${port}`], env: [], stdin: '1234', stdout: '5678' };
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => mockProcess);

        expect(streamProvider.useDebugSocketStream).to.not.be.equal(true, 'incorrect');
    });
});
