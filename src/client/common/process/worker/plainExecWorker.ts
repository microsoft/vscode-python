import { isMainThread, parentPort, workerData } from 'worker_threads';
import { _workerPlainExecImpl } from './workerRawProcessApis';

if (!isMainThread) {
    _workerPlainExecImpl(workerData.file, workerData.args, workerData.options)
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
}
