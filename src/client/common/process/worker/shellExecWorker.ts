import { parentPort, workerData } from 'worker_threads';
import { workerShellExec } from './workerRawProcessApis';

workerShellExec(workerData.command, workerData.options, workerData.defaultEnv, workerData.disposables)
    .then((res) => {
        if (!parentPort) {
            throw new Error('Not in a worker thread');
        }
        parentPort.postMessage(res);
    })
    .catch((ex) => {
        if (!parentPort) {
            throw new Error('Not in a worker thread');
        }
        parentPort.postMessage(ex);
    });
