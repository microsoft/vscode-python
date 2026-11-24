// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import { CancellationTokenSource } from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import { createDeferred } from '../../../client/common/utils/async';
import { createReaderPipe, generateRandomPipeName } from '../../../client/common/pipes/namedPipes';

const TEST_TIMEOUT_MS = 2_000;

async function waitFor<T>(promise: Promise<T>, description: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${description}`)), TEST_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

suite('POSIX named pipe reader', () => {
    test('delivers buffered messages and closes when the FIFO writer closes', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        const pipeName = generateRandomPipeName('python-test-fifo-reader');
        const reader = await createReaderPipe(pipeName);
        const received: rpc.Message[] = [];
        const closed = createDeferred<void>();
        const listener = reader.listen((message) => received.push(message));
        const closeListener = reader.onClose(() => closed.resolve());
        const stream = fs.createWriteStream(pipeName);
        const writer = new rpc.StreamMessageWriter(stream, 'utf-8');
        const expected: rpc.NotificationMessage[] = Array.from({ length: 20 }, (_, value) => ({
            jsonrpc: '2.0',
            method: 'test/message',
            params: { value, data: 'x'.repeat(4_096) },
        }));

        try {
            for (const message of expected) {
                await writer.write(message);
            }
            writer.end();

            await waitFor(closed.promise, 'the FIFO reader to close');

            assert.deepStrictEqual(received, expected);
        } finally {
            listener.dispose();
            closeListener.dispose();
            reader.dispose();
            writer.dispose();
            await fs.promises.rm(pipeName, { force: true });
        }
    });

    test('closes when a connected FIFO writer sends no messages', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        const pipeName = generateRandomPipeName('python-test-fifo-empty');
        const reader = await createReaderPipe(pipeName);
        const closed = createDeferred<void>();
        const listener = reader.listen(() => undefined);
        const closeListener = reader.onClose(() => closed.resolve());
        const stream = fs.createWriteStream(pipeName);

        try {
            await new Promise<void>((resolve, reject) => {
                stream.once('open', () => setTimeout(resolve, 50));
                stream.once('error', reject);
            });
            stream.end();

            await waitFor(closed.promise, 'the empty FIFO reader to close');
        } finally {
            listener.dispose();
            closeListener.dispose();
            reader.dispose();
            stream.destroy();
            await fs.promises.rm(pipeName, { force: true });
        }
    });

    test('closes on cancellation when no FIFO writer connected', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        const pipeName = generateRandomPipeName('python-test-fifo-cancel');
        const cancellation = new CancellationTokenSource();
        const reader = await createReaderPipe(pipeName, cancellation.token);
        const closed = createDeferred<void>();
        const listener = reader.listen(() => undefined);
        const closeListener = reader.onClose(() => closed.resolve());

        try {
            cancellation.cancel();
            await waitFor(closed.promise, 'the cancelled FIFO reader to close');
        } finally {
            listener.dispose();
            closeListener.dispose();
            reader.dispose();
            cancellation.dispose();
            await fs.promises.rm(pipeName, { force: true });
        }
    });
});
