// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-invalid-this max-classes-per-file

import { expect } from 'chai';
import { spawn } from 'child_process';
import { ProcessService } from '../../../client/common/process/proc';
import { createDeferred } from '../../../client/common/utils/async';
import { PYTHON_PATH } from '../../common';

suite('Process - Process Service', function () {
    // tslint:disable-next-line:no-invalid-this
    this.timeout(5000);
    let procIdsToKill: number[] = [];
    teardown(() => {
        // tslint:disable-next-line:no-require-imports
        const killProcessTree = require('tree-kill');
        procIdsToKill.forEach(pid => {
            try {
                killProcessTree(pid);
            } catch {
                // Ignore.
            }
        });
        procIdsToKill = [];
    });

    function spawnProc() {
        const proc = spawn(PYTHON_PATH, ['-c', 'while(True): import time;time.sleep(0.5);print(1)']);
        const exited = createDeferred<Boolean>();
        proc.on('exit', () => exited.resolve(true));
        procIdsToKill.push(proc.pid);

        return { pid: proc.pid, exited: exited.promise };
    }

    test('Process is killed', async () => {
        const proc = spawnProc();

        ProcessService.kill(proc.pid);

        expect(await proc.exited).to.equal(true, 'process did not die');
    });
    test('Process is alive', async () => {
        const proc = spawnProc();

        expect(ProcessService.isAlive(proc.pid)).to.equal(true, 'process is not alive');
    });

});
