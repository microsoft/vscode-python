import { assert } from 'chai';
import { unlink } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { traceError } from '../../client/common/logger';
import { sleep } from '../../client/common/utils/async';
import { CrossProcessLock } from '../../client/datascience/crossProcessLock';

suite('Cross process lock', async () => {
    let mutex1: CrossProcessLock;
    let mutex2: CrossProcessLock;

    suiteSetup(() => {
        // Create two named mutexes with the same name
        mutex1 = new CrossProcessLock('crossProcessLockUnitTest');
        mutex2 = new CrossProcessLock('crossProcessLockUnitTest');
    });

    suiteTeardown(async () => {
        // Delete the lockfile so it's clean for the next run
        unlink(path.join(tmpdir(), 'crossProcessLockUnitTest.tmp'), (err) => {
            traceError(err);
        });
    });

    test('Lock guarantees in-process mutual exclusion', async () => {
        const result1 = await mutex1.lock();
        assert.equal(result1, true); // Expect to successfully acquire the lock since it's not held
        const result2 = await Promise.race([mutex2.lock(), sleep(1000)]);
        assert.equal(result2, 1000); // Expect the sleep to resolve before the mutex is acquired
    }).timeout(10000);
});
