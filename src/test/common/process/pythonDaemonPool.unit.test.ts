// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import { MessageConnection } from 'vscode-jsonrpc';
import { ProcessLogger } from '../../../client/common/process/logger';
import { PythonDaemonExecutionService } from '../../../client/common/process/pythonDaemon';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { InterpreterInfomation, IProcessLogger, IPythonExecutionService, Output } from '../../../client/common/process/types';
import { sleep } from '../../../client/common/utils/async';
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
    let logger: IProcessLogger;
    setup(() => {
        logger = instance(mock(ProcessLogger));
        pythonExecService = mock(PythonExecutionService);
        (instance(pythonExecService) as any).then = undefined;
        sendRequestStub = sinon.stub();
        listenStub = sinon.stub();
        listenStub.returns(undefined);
        sendRequestStub.returns({ pong: 'hello' });
    });
    teardown(() => {
        sinon.restore();
    });

    async function setupDaemon(daemonPoolService: DaemonPool) {
        const mockMessageConnection = ({
            sendRequest: sendRequestStub,
            listen: listenStub,
            onClose: noop,
            onDispose: noop,
            onError: noop,
            onNotification: noop
        } as any) as MessageConnection;
        const daemonProc = (new EventEmitter() as any) as ChildProcess;
        daemonProc.killed = false;
        daemonProc.pid = process.pid;
        daemonProc.kill = noop;
        daemonProc.stdout = new EventEmitter() as any;
        daemonProc.stderr = new EventEmitter() as any;

        when(pythonExecService.execModuleObservable('datascience.daemon', anything(), anything())).thenReturn({ proc: daemonProc, dispose: noop, out: undefined as any });

        // Create and initialize the pool.
        daemonPoolService.createConnection = () => mockMessageConnection;
        await daemonPoolService.initialize();
    }
    test('Create daemons when initializing', async () => {
        // Create and initialize the pool.
        const pool = new DaemonPool(logger, {pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(3);
        expect(listenStub.callCount).equal(3);
    });
    test('Create specific number of daemons when initializing', async () => {
        // Create and initialize the pool.
        const pool = new DaemonPool(logger, { daemonCount: 5, observableDaemonCount: 3, pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(8);
        expect(listenStub.callCount).equal(8);
    });
    test('Throw error if daemon does not respond to ping within 5s', async () => {
        sendRequestStub.reset();
        sendRequestStub.returns(sleep(6_000).then(({ pong: 'hello' } as any)));
        // Create and initialize the pool.
        const pool = new DaemonPool(logger, { daemonCount: 5, observableDaemonCount: 3, pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        const promise = setupDaemon(pool);

        expect(promise).to.eventually.be.rejectedWith('Timeout');
    });
    test('If executing python is fast, then use the daemon', async () => {
        const getInterpreterInformationStub = sinon.stub(PythonDaemonExecutionService.prototype, 'getInterpreterInformation');
        const interpreterInfoFromDaemon: InterpreterInfomation = { pythonPath: 1 } as any;
        // Delay returning interpreter info for 2 seconds.
        getInterpreterInformationStub.resolves(interpreterInfoFromDaemon);

        // Create and initialize the pool.
        const pool = new DaemonPool(logger, { daemonCount: 1, observableDaemonCount: 1, pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(2);
        expect(listenStub.callCount).equal(2);

        const [info1, info2, info3] = await Promise.all([pool.getInterpreterInformation(), pool.getInterpreterInformation(), pool.getInterpreterInformation()]);

        // Verify we used the daemon.
        expect(getInterpreterInformationStub.callCount).to.equal(3);
        // Verify we used the python execution service.
        verify(pythonExecService.getInterpreterInformation()).never();

        expect(info1).to.deep.equal(interpreterInfoFromDaemon);
        expect(info2).to.deep.equal(interpreterInfoFromDaemon);
        expect(info3).to.deep.equal(interpreterInfoFromDaemon);
    });
    test('If executing python code takes too long (> 1s), then return standard PythonExecutionService', async () => {
        const getInterpreterInformationStub = sinon.stub(PythonDaemonExecutionService.prototype, 'getInterpreterInformation');
        const interpreterInfoFromDaemon: InterpreterInfomation = { pythonPath: 1 } as any;
        const interpreterInfoFromPythonProc: InterpreterInfomation = { pythonPath: 2 } as any;
        // Delay returning interpreter info for 1.5 seconds.
        getInterpreterInformationStub.returns(sleep(1_500).then(() => interpreterInfoFromDaemon));
        when(pythonExecService.getInterpreterInformation()).thenResolve(interpreterInfoFromPythonProc);

        // Create and initialize the pool.
        const pool = new DaemonPool(logger, { daemonCount: 2, observableDaemonCount: 1, pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(3);
        expect(listenStub.callCount).equal(3);

        const [info1, info2, info3, info4] = await Promise.all([
            pool.getInterpreterInformation(),
            pool.getInterpreterInformation(),
            pool.getInterpreterInformation(),
            pool.getInterpreterInformation()
        ]);

        // Verify we used the daemon.
        expect(getInterpreterInformationStub.callCount).to.equal(2);
        // Verify we used the python execution service.
        verify(pythonExecService.getInterpreterInformation()).twice();

        expect(info1).to.deep.equal(interpreterInfoFromDaemon);
        expect(info2).to.deep.equal(interpreterInfoFromDaemon);
        expect(info3).to.deep.equal(interpreterInfoFromPythonProc);
        expect(info4).to.deep.equal(interpreterInfoFromPythonProc);
    }).timeout(3_000);
    test('If executing python is fast, then use the daemon (for observables)', async () => {
        const execModuleObservable = sinon.stub(PythonDaemonExecutionService.prototype, 'execModuleObservable');
        const out = new Observable<Output<string>>(s => {
            s.next({source: 'stdout', out: ''});
            s.complete();
        });
        execModuleObservable.returns({out} as any);

        // Create and initialize the pool.
        const pool = new DaemonPool(logger, { daemonCount: 1, observableDaemonCount: 1, pythonPath: 'py.exe' }, instance(pythonExecService), undefined);
        await setupDaemon(pool);

        // 3 = 2 for standard daemon + 1 observable daemon.
        expect(sendRequestStub.callCount).equal(2);
        expect(listenStub.callCount).equal(2);

        // Invoke the execModuleObservable method twice (one to use daemon, other will use python exec service).
        reset(pythonExecService);
        when(pythonExecService.execModuleObservable(anything(), anything(), anything())).thenReturn(({out} as any));
        await Promise.all([pool.execModuleObservable('x', [], {}), pool.execModuleObservable('x', [], {})]);

        // Verify we used the daemon.
        expect(execModuleObservable.callCount).to.equal(1);
        // Verify we used the python execution service.
        verify(pythonExecService.execModuleObservable(anything(), anything(), anything())).once();
    });
});
