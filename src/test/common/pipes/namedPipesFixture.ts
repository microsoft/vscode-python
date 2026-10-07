// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import fs from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import * as sinon from 'sinon';
import * as rpc from 'vscode-jsonrpc/node';
import { createReaderPipe } from '../../../client/common/pipes/namedPipes';
import { createDeferred } from '../../../client/common/utils/async';

export async function verifyDescriptorOwnership(directory: string, scenario: string): Promise<void> {
    const sandbox = sinon.createSandbox();
    const pipeName = path.join(directory, 'results');
    const replacementFile = path.join(directory, 'replacement');
    fs.writeFileSync(replacementFile, 'Replacement descriptor is still usable.');

    // Capture the real transport without replacing the socket or its native close.
    const open = sandbox.spy(fs, 'open');
    const close = sandbox.spy(fs, 'close');
    const { SocketMessageReader } = rpc;
    const constructReader = sandbox
        .stub(rpc, 'SocketMessageReader')
        .callsFake((socket, encoding) => new SocketMessageReader(socket, encoding));
    const replacementDescriptors: number[] = [];
    let writer: number | undefined;
    let socket: net.Socket | undefined;
    let reader: rpc.MessageReader | undefined;

    try {
        reader = await createReaderPipe(pipeName);
        const descriptor: unknown = await open.firstCall.returnValue;
        assert.ok(typeof descriptor === 'number');
        socket = constructReader.firstCall.args[0];
        assert.ok(socket);
        const dispose = sandbox.spy(reader, 'dispose');
        const received = createDeferred<rpc.Message>();
        const errors: Error[] = [];
        reader.onError((error) => errors.push(error));
        reader.listen((message) => received.resolve(message));

        const message = { jsonrpc: '2.0', method: 'test/result', params: { result: 'passed \u2713' } };
        const payload = JSON.stringify(message);
        writer = fs.openSync(pipeName, 'w');
        fs.writeSync(writer, `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
        assert.deepStrictEqual(await received.promise, message);

        const replacement = createDeferred<number>();
        socket.prependOnceListener('close', () => {
            try {
                // Native close has released the FIFO. Reuse its number before application cleanup runs.
                let next: number;
                do {
                    next = fs.openSync(replacementFile, 'r');
                    replacementDescriptors.push(next);
                } while (next < descriptor);
                assert.strictEqual(next, descriptor, 'The FIFO descriptor must be released by the socket.');
                replacement.resolve(next);
            } catch (error) {
                replacement.reject(error);
            }
        });

        const closed = new Promise<boolean>((resolve) => socket?.once('close', resolve));
        const error = scenario === 'error' ? new Error('FIFO read failed') : undefined;
        socket.destroy(error);
        assert.strictEqual(await closed, error !== undefined);
        const replacementDescriptor = await replacement.promise;

        // Await any application-initiated close so the old implementation fails without a timing race.
        await Promise.all(close.returnValues);
        assert.strictEqual(fs.readFileSync(replacementDescriptor, 'utf-8'), 'Replacement descriptor is still usable.');
        sinon.assert.calledOnce(dispose);
        assert.deepStrictEqual(errors, error ? [error] : []);

        reader.dispose();
        assert.ok(
            fs.fstatSync(replacementDescriptor).isFile(),
            'Repeated reader disposal must leave the new owner alone.',
        );
    } finally {
        socket?.destroy();
        reader?.dispose();
        if (writer !== undefined) {
            fs.closeSync(writer);
        }
        for (const descriptor of replacementDescriptors) {
            try {
                fs.closeSync(descriptor);
            } catch (error) {
                // The regression closes this descriptor on the unfixed implementation.
                assert.strictEqual((error as NodeJS.ErrnoException).code, 'EBADF');
            }
        }
        sandbox.restore();
    }
}

if (require.main === module) {
    verifyDescriptorOwnership(process.argv[2], process.argv[3]).catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
