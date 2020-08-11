import * as assert from 'assert';
import { WorkerPool } from '../../../client/pythonEnvironments/info/workerPool';

suite('Process Queue', () => {
    test('Run two workers to calculate square', async () => {
        const workerPool = new WorkerPool<number, number>((i) => Promise.resolve(i * i));
        const promises: Promise<number>[] = [];
        const results: number[] = [];
        [2, 3, 4, 5, 6].forEach((i) => promises.push(workerPool.addToQueue(i)));
        await Promise.all(promises).then((r) => {
            results.push(...r);
        });
        assert.deepEqual(results, [4, 9, 16, 25, 36]);
    });

    test('Run, wait for result, run again', async () => {
        const workerPool = new WorkerPool<number, number>((i) => Promise.resolve(i * i));
        let promises: Promise<number>[] = [];
        let results: number[] = [];
        [2, 3, 4].forEach((i) => promises.push(workerPool.addToQueue(i)));
        await Promise.all(promises).then((r) => {
            results.push(...r);
        });
        assert.deepEqual(results, [4, 9, 16]);

        promises = [];
        results = [];
        [5, 6, 7, 8].forEach((i) => promises.push(workerPool.addToQueue(i)));
        await Promise.all(promises).then((r) => {
            results.push(...r);
        });
        assert.deepEqual(results, [25, 36, 49, 64]);
    });

    test('Run two workers and stop in between', async () => {
        const workerPool = new WorkerPool<number, number>(async (i) => {
            if (i === 4) {
                workerPool.stop();
            }
            return Promise.resolve(i * i);
        });
        const promises: Promise<number>[] = [];
        const results: number[] = [];
        const reasons: Error[] = [];
        [2, 3, 4, 5, 6].forEach((i) => promises.push(workerPool.addToQueue(i)));
        for (const v of promises) {
            try {
                results.push(await v);
            } catch (reason) {
                reasons.push(reason);
            }
        }
        assert.deepEqual(results, [4, 9]);
        assert.deepEqual(reasons, [
            Error('Queue stopped processing'),
            Error('Queue stopped processing'),
            Error('Queue stopped processing')
        ]);
    });

    test('Add to a stopped queue', async () => {
        const workerPool = new WorkerPool<number, number>(async (i) => Promise.resolve(i * i));
        workerPool.stop();
        const reasons: Error[] = [];
        try {
            await workerPool.addToQueue(2);
        } catch (reason) {
            reasons.push(reason);
        }
        assert.deepEqual(reasons, [Error('Queue is stopped')]);
    });

    test('Worker function fails', async () => {
        const workerPool = new WorkerPool<number, number>(async (i) => {
            if (i === 4) {
                throw Error('Bad input');
            }
            return Promise.resolve(i * i);
        });
        const promises: Promise<number>[] = [];
        const results: number[] = [];
        const reasons: string[] = [];
        [2, 3, 4, 5, 6].forEach((i) => promises.push(workerPool.addToQueue(i)));
        for (const v of promises) {
            try {
                results.push(await v);
            } catch (reason) {
                reasons.push(reason);
            }
        }
        assert.deepEqual(reasons, [Error('Bad input')]);
        assert.deepEqual(results, [4, 9, 25, 36]);
    });
});
