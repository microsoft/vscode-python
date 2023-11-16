import { parentPort, workerData } from 'worker_threads';
import { _workerPlainExecImpl } from './workerRawProcessApis';

_workerPlainExecImpl(
    workerData.file,
    workerData.args,
    workerData.options,
    workerData.defaultEnv,
    workerData.disposables,
)
    .then((res) => {
        if (!parentPort) {
            throw new Error('Not in a worker thread');
        }
        parentPort.postMessage({ res });
    })
    .catch((err) => {
        if (!parentPort) {
            throw new Error('Not in a worker thread');
        }
        parentPort.postMessage({ err });
    });
