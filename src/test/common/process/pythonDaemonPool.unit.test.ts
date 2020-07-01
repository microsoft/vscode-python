// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fakeTimers from '@sinonjs/fake-timers';
import { expect, use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import { MessageConnection } from 'vscode-jsonrpc';
import { IPlatformService } from '../../../client/common/platform/types';
import { ProcessLogger } from '../../../client/common/process/logger';
import { PythonDaemonExecutionService } from '../../../client/common/process/pythonDaemon';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import { IProcessLogger, IPythonExecutionService, Output } from '../../../client/common/process/types';
import { sleep } from '../../../client/common/utils/async';
import { InterpreterInformation } from '../../../client/pythonEnvironments/info';
import { noop } from '../../core';
use(chaiPromised);

// tslint:disable: no-any max-func-body-length
suite('Daemon - Python Daemon Pool', () => {
    class DaemonPool extends PythonDaemonExecutionServicePool {
        // tslint:disable-next-line: no-unnecessary-override
        public createConnection(proc: ChildProcess) {
            return super.createConnection(proc);
        }
    }
    // tslint:disable-next-line: no-any use-default-type-parameter
    let sendRequestStub: sinon.SinonStub<any[], any>;
    // tslint:disable-next-line: no-any use-default-type-parameter
    let listenStub: sinon.SinonStub<any[], any>;
    let pythonExecService: IPythonExecutionService;
    let platformService: IPlatformService;
    let logger: IProcessLogger;
    let clock: fakeTimers.InstalledClock;
    setup(() => {
        logger = instance(mock(ProcessLogger));
        pythonExecService = mock<IPythonExecutionService>();
        platformService = mock<IPlatformService>();
        (instance(pythonExecService) as any).then = undefined;
        sendRequestStub = sinon.stub();
        listenStub = sinon.stub();
        listenStub.returns(undefined);
        sendRequestStub.returns({ pong: 'hello' });
    });
    teardown(() => {
        if (clock) {
            clock.uninstall();
        }
        sinon.restore();
    });

    async function setupDaemon(daemonPoolService: DaemonPool) {
        const mockMessageConnection = ({
            sendRequest: sendRequestStub,
            listen: listenStub,
            onClose: noop,
            onDispose: noop,
            onError: noop,
            onNotification: noop,
            onUnhandledNotification: noop
        } as any) as MessageConnection;
        const daemonProc = (new EventEmitter() as any) as ChildProcess;
        daemonProc.killed = false;
        daemonProc.pid = process.pid;
        daemonProc.kill = noop;
        daemonProc.stdout = new EventEmitter() as any;
        daemonProc.stderr = new EventEmitter() as any;

        when(
            pythonExecService.execModuleObservable('vscode_datascience_helpers.daemon', anything(), anything())
        ).thenReturn({
            proc: daemonProc,
            dispose: noop,
            out: undefined as any
        });

        // Create and initialize the pool.
        daemonPoolService.createConnection = () => mockMessageConnection;
        await daemonPoolService.initialize();
    }
    test('Create daemons when initializing', async () => {
        // Create and initialize the pool.
        const pool = new DaemonPool(
            logger,
            [],
            { pythonPath: 'py.exe' },
            instance(pythonExecService),
            instance(platformService),
            undefined
        );
        await setupDaemon(pool);

        // 2 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(3);
        expect(listenStub.callCount).equal(3);
    });
    test('Create specific number of daemons when initializing', async () => {
        // Create and initialize the pool.
        const pool = new DaemonPool(
            logger,
            [],
            { daemonCount: 5, observableDaemonCount: 3, pythonPath: 'py.exe' },
            instance(pythonExecService),
            instance(platformService),
            undefined
        );
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(8);
        expect(listenStub.callCount).equal(8);
    });
    test('Throw error if daemon does not respond to ping within 5s', async () => {
        clock = fakeTimers.install();
        sendRequestStub.reset();
        sendRequestStub.returns(sleep(6_000).then({ pong: 'hello' } as any));
        // Create and initialize the pool.
        const pool = new DaemonPool(
            logger,
            [],
            { daemonCount: 5, observableDaemonCount: 3, pythonPath: 'py.exe' },
            instance(pythonExecService),
            instance(platformService),
            undefined
        );
        const promise = setupDaemon(pool);

        // Ensure all exceptions are handled.
        promise.catch(noop);

        // Move time forward to trigger timeout error (the limit is 5s).
        await clock.tickAsync(5_000);
        await clock.runAllAsync();

        await expect(promise).to.eventually.be.rejectedWith('Timeout');
    });
    test('If executing python is fast, then use the daemon', async () => {
        const getInterpreterInformationStub = sinon.stub(
            PythonDaemonExecutionService.prototype,
            'getInterpreterInformation'
        );
        const interpreterInfoFromDaemon: InterpreterInformation = { pythonPath: 1 } as any;
        // Delay returning interpreter info for 2 seconds.
        getInterpreterInformationStub.resolves(interpreterInfoFromDaemon);

        // Create and initialize the pool.
        const pool = new DaemonPool(
            logger,
            [],
            { daemonCount: 1, observableDaemonCount: 1, pythonPath: 'py.exe' },
            instance(pythonExecService),
            instance(platformService),
            undefined
        );
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(2);
        expect(listenStub.callCount).equal(2);

        const [info1, info2, info3] = await Promise.all([
            pool.getInterpreterInformation(),
            pool.getInterpreterInformation(),
            pool.getInterpreterInformation()
        ]);

        // Verify we used the daemon.
        expect(getInterpreterInformationStub.callCount).to.equal(3);
        // Verify we used the python execution service.
        verify(pythonExecService.getInterpreterInformation()).never();

        expect(info1).to.deep.equal(interpreterInfoFromDaemon);
        expect(info2).to.deep.equal(interpreterInfoFromDaemon);
        expect(info3).to.deep.equal(interpreterInfoFromDaemon);
    });
    test('If executing python code takes too long (> 1s), then return standard PythonExecutionService', async () => {
        clock = fakeTimers.install();
        const getInterpreterInformationStub = sinon.stub(
            PythonDaemonExecutionService.prototype,
            'getInterpreterInformation'
        );
        const interpreterInfoFromDaemon: InterpreterInformation = { pythonPath: 1 } as any;
        const interpreterInfoFromPythonProc: InterpreterInformation = { pythonPath: 2 } as any;

        try {
            let daemonsBusyExecutingCode = 0;
            let daemonsExecuted = 0;
            // Delay returning interpreter info for 5 seconds.
            getInterpreterInformationStub.value(async () => {
                daemonsBusyExecutingCode += 1;
                // Add an artificial delay to cause daemon to be busy.
                await sleep(5_000);
                daemonsExecuted += 1;
                return interpreterInfoFromDaemon;
            });
            when(pythonExecService.getInterpreterInformation()).thenResolve(interpreterInfoFromPythonProc);

            // Create and initialize the pool.
            const pool = new DaemonPool(
                logger,
                [],
                { daemonCount: 2, observableDaemonCount: 1, pythonPath: 'py.exe' },
                instance(pythonExecService),
                instance(platformService),
                undefined
            );

            await setupDaemon(pool);

            // 3 = 2 for standard daemon + 1 observable daemon.
            expect(sendRequestStub.callCount).equal(3);
            expect(listenStub.callCount).equal(3);

            // Lets get interpreter information.
            // As we have 2 daemons in the pool, 2 of the requests will be processed by the two daemons.
            // As getting interpreter information will take 1.5s (see above), the daemon pool will
            // end up using standard process code to serve the other 2 requests.
            // 4 requests = 2 served by daemons, and other 2 served by standard processes.
            const promises = Promise.all([
                pool.getInterpreterInformation(),
                pool.getInterpreterInformation(),
                pool.getInterpreterInformation(),
                pool.getInterpreterInformation()
            ]);

            // Daemon pool will wait for 1s, after 500ms, it is still waiting for daemons to get free.
            await clock.tickAsync(500);
            // Confirm the fact that we didn't use standard processes to get interpreter info.
            verify(pythonExecService.getInterpreterInformation()).never();

            // Confirm the fact that daemon is still busy.
            expect(daemonsBusyExecutingCode).to.equal(2); // Started.
            expect(daemonsExecuted).to.equal(0); // Not yet finished.
            expect(getInterpreterInformationStub.callCount).to.equal(0); // Not yet finished.

            // Daemon pool will wait for 1s, after which it will resort to using standard processes.
            // Move time forward by 1s & then daemon pool will resort to using standard processes.
            await clock.tickAsync(1000);

            // Confirm standard process was used.
            verify(pythonExecService.getInterpreterInformation()).twice();

            // Confirm the fact that daemon is still busy.
            expect(daemonsBusyExecutingCode).to.equal(2); // Started.
            expect(daemonsExecuted).to.equal(0); // Not yet finished.
            expect(getInterpreterInformationStub.callCount).to.equal(0); // Not yet finished.

            // We know getting interpreter info from daemon will take 5seconds.
            // Lets let that complete.
            await clock.tickAsync(5_000);
            await clock.runAllAsync();

            const [info1, info2, info3, info4] = await promises;

            // Verify the fact that the first 2 requests were served by daemons.
            expect(info1).to.deep.equal(interpreterInfoFromDaemon);
            expect(info2).to.deep.equal(interpreterInfoFromDaemon);
            expect(daemonsExecuted).to.equal(2); // 2 daemons called this.

            // Verify the fact that the seconds 2 requests were served by standard processes.
            expect(info3).to.deep.equal(interpreterInfoFromPythonProc);
            expect(info4).to.deep.equal(interpreterInfoFromPythonProc);
            verify(pythonExecService.getInterpreterInformation()).twice(); // 2 standard processes called this.
        } finally {
            // Make sure to remove the stub or other tests will take too long.
            getInterpreterInformationStub.restore();
        }
    });
    test('If executing python is fast, then use the daemon (for observables)', async () => {
        const execModuleObservable = sinon.stub(PythonDaemonExecutionService.prototype, 'execModuleObservable');
        const out = new Observable<Output<string>>((s) => {
            s.next({ source: 'stdout', out: '' });
            s.complete();
        });
        execModuleObservable.returns({ out } as any);

        // Create and initialize the pool.
        const pool = new DaemonPool(
            logger,
            [],
            { daemonCount: 1, observableDaemonCount: 1, pythonPath: 'py.exe' },
            instance(pythonExecService),
            instance(platformService),
            undefined
        );
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(2);
        expect(listenStub.callCount).equal(2);

        // Invoke the execModuleObservable method twice (one to use daemon, other will use python exec service).
        reset(pythonExecService);
        when(pythonExecService.execModuleObservable(anything(), anything(), anything())).thenReturn({ out } as any);
        await Promise.all([pool.execModuleObservable('x', [], {}), pool.execModuleObservable('x', [], {})]);

        // Verify we used the daemon.
        expect(execModuleObservable.callCount).to.equal(1);
        // Verify we used the python execution service.
        verify(pythonExecService.execModuleObservable(anything(), anything(), anything())).once();
    });
});
