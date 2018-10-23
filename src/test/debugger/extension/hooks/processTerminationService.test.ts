// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-invalid-this max-classes-per-file

import { expect } from 'chai';
import { spawn } from 'child_process';
import { ProcessService } from '../../../../client/common/process/proc';
import { createDeferred } from '../../../../client/common/utils/async';
import { ProcessTerminationService } from '../../../../client/debugger/extension/hooks/processTerminationService';
import { PYTHON_PATH } from '../../../common';

suite('Debug - Process Termination', function () {
    // tslint:disable-next-line:no-invalid-this
    this.timeout(5000);
    let procIdsToKill: number[] = [];
    teardown(() => {
        procIdsToKill.forEach(pid => ProcessService.kill(pid));
        procIdsToKill = [];
    });

    function spawnProc() {
        const proc = spawn(PYTHON_PATH, ['-c', 'while(True): import time;time.sleep(0.5);print(1)']);
        const exited = createDeferred<Boolean>();
        proc.on('exit', () => exited.resolve(true));
        procIdsToKill.push(proc.pid);

        return { pid: proc.pid, exited: exited.promise };
    }

    test('Orphaned Process is killed', async () => {
        const proc = spawnProc();
        const service = new class extends ProcessTerminationService {
            protected getDeadProcessIds() {
                return [proc.pid];
            }
        }([]);

        service.trackProcess(proc.pid);
        service.terminateOrphanedProcesses();
        expect(await proc.exited).to.equal(true, 'process did not die');
    });
    test('Process is killed when disposing', async () => {
        const proc = spawnProc();
        const service = new class extends ProcessTerminationService {
            protected getDeadProcessIds() {
                return [];
            }
        }([]);

        service.trackProcess(proc.pid);
        service.dispose();
        expect(await proc.exited).to.equal(true, 'process did not die');
    });
    test('Related child process is killed when parent is killed', async () => {
        const parentProc = spawnProc();
        const childProc = spawnProc();
        const service = new class extends ProcessTerminationService {
            protected getDeadProcessIds() {
                return [];
            }
        }([]);

        service.trackProcess(childProc.pid, parentProc.pid);
        service.terminateProcess(parentProc.pid);

        expect(await parentProc.exited).to.equal(true, 'main process did not die');
        expect(await childProc.exited).to.equal(true, 'child process did not die');
    });
    test('Related child process is killed when grand parent is killed', async () => {
        const grandParentProc = spawnProc();
        const parentProc = spawnProc();
        const childProc = spawnProc();
        const service = new class extends ProcessTerminationService {
            protected getDeadProcessIds() {
                return [];
            }
        }([]);

        service.trackProcess(parentProc.pid, grandParentProc.pid);
        service.trackProcess(childProc.pid, parentProc.pid);

        service.terminateProcess(grandParentProc.pid);

        expect(await grandParentProc.exited).to.equal(true, 'grand parent process did not die');
        expect(await parentProc.exited).to.equal(true, 'main process did not die');
        expect(await childProc.exited).to.equal(true, 'child process did not die');
    });
    test('Related child process is killed when parent is killed, but grand parent is left alive', async () => {
        const grandParentProc = spawnProc();
        const parentProc = spawnProc();
        const childProc = spawnProc();
        const service = new class extends ProcessTerminationService {
            protected getDeadProcessIds() {
                return [];
            }
        }([]);

        service.trackProcess(parentProc.pid, grandParentProc.pid);
        service.trackProcess(childProc.pid, parentProc.pid);
        service.terminateProcess(parentProc.pid);

        expect(ProcessService.isAlive(grandParentProc.pid)).to.equal(true, 'grand parent process died');
        expect(await parentProc.exited).to.equal(true, 'main process did not die');
        expect(await childProc.exited).to.equal(true, 'child process did not die');
    });
});
