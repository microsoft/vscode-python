// This code is executed in the worker and not in the main thread.

import { parentPort } from 'worker_threads';

// Send a message to the main thread.

if (!parentPort) {
    throw new Error('Not in a worker thread');
}

parentPort.postMessage('Hello world!');
