// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect, use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { spawn, spawnSync } from 'child_process';
import * as dedent from 'dedent';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { IPlatformService } from '../../../client/common/platform/types';
import { ProcessLogger } from '../../../client/common/process/logger';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import {
    IProcessLogger,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    Output
} from '../../../client/common/process/types';
import { IDisposable } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { Architecture } from '../../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { JupyterDaemonModule } from '../../../client/datascience/constants';
import { PythonVersionInfo } from '../../../client/pythonEnvironments/info';
import { parsePythonVersion } from '../../../client/pythonEnvironments/info/pythonVersion';
import { isPythonVersion, PYTHON_PATH, waitForCondition } from '../../common';
import { createTemporaryFile } from '../../utils/fs';
use(chaiPromised);

// tslint:disable: max-func-body-length
suite('Daemon - Python Daemon Pool', () => {
    // Set PYTHONPATH to pickup our module and the jsonrpc modules.
    const envPythonPath = `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(
        EXTENSION_ROOT_DIR,
        'pythonFiles',
        'lib',
        'python'
    )}`;
    const env = { PYTHONPATH: envPythonPath, PYTHONUNBUFFERED: '1' };
    let fullyQualifiedPythonPath: string = PYTHON_PATH;
    let pythonDaemonPool: PythonDaemonExecutionServicePool;
    let pythonExecutionService: IPythonExecutionService;
    let platformService: IPlatformService;
    let disposables: IDisposable[] = [];
    let createDaemonServicesSpy: sinon.SinonSpy<[], Promise<IPythonDaemonExecutionService | IDisposable>>;
    let logger: IProcessLogger;
    class DaemonPool extends PythonDaemonExecutionServicePool {
        // tslint:disable-next-line: no-unnecessary-override
        public createDaemonService<T extends IPythonDaemonExecutionService | IDisposable>(): Promise<T> {
            return super.createDaemonService();
        }
    }
    suiteSetup(() => {
        // When running locally.
        if (PYTHON_PATH.toLowerCase() === 'python') {
            fullyQualifiedPythonPath = spawnSync(PYTHON_PATH, ['-c', 'import sys;print(sys.executable)'])
                .stdout.toString()
                .trim();
        }
    });
    setup(async function () {
        if (isPythonVersion('2.7')) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }
        logger = mock(ProcessLogger);
        createDaemonServicesSpy = sinon.spy(DaemonPool.prototype, 'createDaemonService');
        pythonExecutionService = mock<IPythonExecutionService>();
        platformService = mock<IPlatformService>();
        when(
            pythonExecutionService.execModuleObservable('vscode_datascience_helpers.daemon', anything(), anything())
        ).thenCall(() => {
            const pythonProc = spawn(fullyQualifiedPythonPath, ['-m', 'vscode_datascience_helpers.daemon'], { env });
            const connection = createMessageConnection(
                new StreamMessageReader(pythonProc.stdout),
                new StreamMessageWriter(pythonProc.stdin)
            );
            connection.listen();
            disposables.push({ dispose: () => pythonProc.kill() });
            disposables.push({ dispose: () => connection.dispose() });
            // tslint:disable-next-line: no-any
            return { proc: pythonProc, dispose: noop, out: undefined as any };
        });
        const options = {
            pythonPath: fullyQualifiedPythonPath,
            daemonModule: JupyterDaemonModule,
            daemonCount: 2,
            observableDaemonCount: 1
        };
        pythonDaemonPool = new DaemonPool(
            logger,
            [],
            options,
            instance(pythonExecutionService),
            instance(platformService),
            {},
            100
        );
        await pythonDaemonPool.initialize();
        disposables.push(pythonDaemonPool);
    });
    teardown(() => {
        sinon.restore();
        disposables.forEach((item) => item.dispose());
        disposables = [];
    });
    async function getStdOutFromObservable(output: ObservableExecutionResult<string>) {
        return new Promise<string>((resolve, reject) => {
            const data: string[] = [];
            output.out.subscribe(
                (out) => data.push(out.out.trim()),
                reject,
                () => resolve(data.join(''))
            );
        });
    }

    async function createPythonFile(source: string): Promise<string> {
        const tmpFile = await createTemporaryFile('.py');
        disposables.push({ dispose: () => tmpFile.cleanupCallback() });
        await fs.writeFile(tmpFile.filePath, source, { encoding: 'utf8' });
        return tmpFile.filePath;
    }

    test('Interpreter Information', async () => {
        type InterpreterInfo = {
            versionInfo: PythonVersionInfo;
            sysPrefix: string;
            sysVersion: string;
            is64Bit: boolean;
        };
        const json: InterpreterInfo = JSON.parse(
            spawnSync(fullyQualifiedPythonPath, [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'interpreterInfo.py')])
                .stdout.toString()
                .trim()
        );
        const versionValue =
            json.versionInfo.length === 4
                ? `${json.versionInfo.slice(0, 3).join('.')}-${json.versionInfo[3]}`
                : json.versionInfo.join('.');
        const expectedVersion = {
            architecture: json.is64Bit ? Architecture.x64 : Architecture.x86,
            path: fullyQualifiedPythonPath,
            version: parsePythonVersion(versionValue),
            sysVersion: json.sysVersion,
            sysPrefix: json.sysPrefix
        };

        const version = await pythonDaemonPool.getInterpreterInformation();

        assert.deepEqual(version, expectedVersion);
    });

    test('Executable path', async () => {
        const execPath = await pythonDaemonPool.getExecutablePath();

        assert.deepEqual(execPath, fullyQualifiedPythonPath);
    });

    async function testModuleInstalled(moduleName: string, expectedToBeInstalled: boolean) {
        await assert.eventually.equal(pythonDaemonPool.isModuleInstalled(moduleName), expectedToBeInstalled);
    }

    test("'pip' module is installed", async () => testModuleInstalled('pip', true));
    test("'unittest' module is installed", async () => testModuleInstalled('unittest', true));
    test("'VSCode-Python-Rocks' module is not Installed", async () =>
        testModuleInstalled('VSCode-Python-Rocks', false));

    test('Execute a file and capture stdout (with unicode)', async () => {
        const source = dedent`
        import sys
        sys.stdout.write("HELLO WORLD-₹-😄")
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemonPool.exec([fileToExecute], {});

        assert.isUndefined(output.stderr);
        assert.deepEqual(output.stdout, 'HELLO WORLD-₹-😄');
    });

    test('Execute a file and capture stderr (with unicode)', async () => {
        const source = dedent`
        import sys
        sys.stderr.write("HELLO WORLD-₹-😄")
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemonPool.exec([fileToExecute], {});

        assert.isUndefined(output.stdout);
        assert.deepEqual(output.stderr, 'HELLO WORLD-₹-😄');
    });

    test('Execute a file with arguments', async () => {
        const source = dedent`
        import sys
        sys.stdout.write(sys.argv[1])
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemonPool.exec([fileToExecute, 'HELLO WORLD'], {});

        assert.isUndefined(output.stderr);
        assert.equal(output.stdout, 'HELLO WORLD');
    });

    test('Execute a file with custom cwd', async () => {
        const source = dedent`
        import os
        print(os.getcwd())
        `;
        const fileToExecute = await createPythonFile(source);
        const output1 = await pythonDaemonPool.exec([fileToExecute, 'HELLO WORLD'], { cwd: EXTENSION_ROOT_DIR });

        assert.isUndefined(output1.stderr);
        assert.equal(output1.stdout.trim(), EXTENSION_ROOT_DIR);

        const output2 = await pythonDaemonPool.exec([fileToExecute, 'HELLO WORLD'], { cwd: __dirname });

        assert.isUndefined(output2.stderr);
        assert.equal(output2.stdout.trim(), __dirname);
    });

    test('Execute a file and capture stdout & stderr', async () => {
        const source = dedent`
        import sys
        sys.stdout.write("HELLO WORLD-₹-😄")
        sys.stderr.write("FOO BAR-₹-😄")
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemonPool.exec([fileToExecute, 'HELLO WORLD'], {});

        assert.equal(output.stdout, 'HELLO WORLD-₹-😄');
        assert.equal(output.stderr, 'FOO BAR-₹-😄');
    });

    test('Execute a file and handle error', async () => {
        const source = dedent`
        import sys
        raise Exception("KABOOM")
        `;
        const fileToExecute = await createPythonFile(source);
        const promise = pythonDaemonPool.exec([fileToExecute], {});
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    });

    test('Execute a file with custom env variable', async () => {
        const source = dedent`
        import os
        print(os.getenv("VSC_HELLO_CUSTOM", "NONE"))
        `;
        const fileToExecute = await createPythonFile(source);

        const output1 = await pythonDaemonPool.exec([fileToExecute], {});

        // Confirm there's no custom variable.
        assert.equal(output1.stdout.trim(), 'NONE');

        // Confirm setting the varible works.
        const output2 = await pythonDaemonPool.exec([fileToExecute], { env: { VSC_HELLO_CUSTOM: 'wow' } });
        assert.equal(output2.stdout.trim(), 'wow');
    });

    test('Execute simple module', async () => {
        const pipVersion = spawnSync(fullyQualifiedPythonPath, ['-c', 'import pip;print(pip.__version__)'])
            .stdout.toString()
            .trim();

        const output = await pythonDaemonPool.execModule('pip', ['--version'], {});

        assert.isUndefined(output.stderr);
        assert.equal(output.stdout.trim(), pipVersion);
    });

    test('Execute a file and stream output', async () => {
        const source = dedent`
        import sys
        import time
        for i in range(5):
            print(i)
            time.sleep(0.1)
        `;
        const fileToExecute = await createPythonFile(source);
        const output = pythonDaemonPool.execObservable([fileToExecute], {});
        const outputsReceived: string[] = [];
        await new Promise((resolve, reject) => {
            output.out.subscribe((out) => outputsReceived.push(out.out.trim()), reject, resolve);
        });
        assert.deepEqual(
            outputsReceived.filter((item) => item.length > 0),
            ['0', '1', '2', '3', '4']
        );
    }).timeout(5_000);

    test('Execute a file and throw exception if stderr is not empty', async () => {
        const fileToExecute = await createPythonFile(['import sys', 'sys.stderr.write("KABOOM")'].join(os.EOL));
        const promise = pythonDaemonPool.exec([fileToExecute], { throwOnStdErr: true });
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    });

    test('Execute a file and throw exception if stderr is not empty when streaming output', async () => {
        const source = dedent`
        import sys
        import time
        time.sleep(0.1)
        sys.stderr.write("KABOOM")
        sys.stderr.flush()
        time.sleep(0.1)
        `;
        const fileToExecute = await createPythonFile(source);
        const output = pythonDaemonPool.execObservable([fileToExecute], { throwOnStdErr: true });
        const outputsReceived: string[] = [];
        const promise = new Promise((resolve, reject) => {
            output.out.subscribe((out) => outputsReceived.push(out.out.trim()), reject, resolve);
        });
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    }).timeout(5_000);
    test('If executing a file takes time, then ensure we use another daemon', async () => {
        const source = dedent`
        import os
        import time
        time.sleep(0.2)
        print(os.getpid())
        `;
        const fileToExecute = await createPythonFile(source);
        // When using the python execution service, return a bogus value.
        when(pythonExecutionService.execObservable(deepEqual([fileToExecute]), anything())).thenCall(() => {
            const observable = new Observable<Output<string>>((s) => {
                s.next({ out: 'mypid', source: 'stdout' });
                s.complete();
            });
            // tslint:disable-next-line: no-any
            return { proc: new EventEmitter() as any, dispose: noop, out: observable };
        });
        // This will use a damon.
        const output1 = pythonDaemonPool.execObservable([fileToExecute], {});
        // These two will use a python execution service.
        const output2 = pythonDaemonPool.execObservable([fileToExecute], {});
        const output3 = pythonDaemonPool.execObservable([fileToExecute], {});
        const [result1, result2, result3] = await Promise.all([
            getStdOutFromObservable(output1),
            getStdOutFromObservable(output2),
            getStdOutFromObservable(output3)
        ]);

        // Two process ids are used to run the code (one process for a daemon, another for bogus puthon process).
        expect(result1).to.not.equal('mypid');
        expect(result2).to.equal('mypid');
        expect(result3).to.equal('mypid');
        verify(pythonExecutionService.execObservable(deepEqual([fileToExecute]), anything())).twice();
    }).timeout(3_000);
    test('Ensure to re-use the same daemon & it goes back into the pool (for observables)', async () => {
        const source = dedent`
        import os
        print(os.getpid())
        `;
        const fileToExecute = await createPythonFile(source);
        // This will use a damon.
        const output1 = await getStdOutFromObservable(pythonDaemonPool.execObservable([fileToExecute], {}));
        // Wait for daemon to go into the pool.
        await sleep(100);
        // This will use a damon.
        const output2 = await getStdOutFromObservable(pythonDaemonPool.execObservable([fileToExecute], {}));
        // Wait for daemon to go into the pool.
        await sleep(100);
        // This will use a damon.
        const output3 = await getStdOutFromObservable(pythonDaemonPool.execObservable([fileToExecute], {}));

        // The pid for all processes is the same.
        // This means we're re-using the same daemon (process).
        expect(output1).to.equal(output2);
        expect(output1).to.equal(output3);
    }).timeout(3_000);
    test('Ensure two different daemons are used to execute code', async () => {
        const source = dedent`
        import os
        import time
        time.sleep(0.2)
        print(os.getpid())
        `;
        const fileToExecute = await createPythonFile(source);

        const [output1, output2] = await Promise.all([
            pythonDaemonPool.exec([fileToExecute], {}),
            pythonDaemonPool.exec([fileToExecute], {})
        ]);

        // The pid for both processes will be different.
        // This means we're running both in two separate daemons.
        expect(output1.stdout).to.not.equal(output2.stdout);
    });
    test('Ensure to create a new daemon if one dies', async () => {
        // Get pids of the 2 daemons.
        const daemonsCreated = createDaemonServicesSpy.callCount;
        const source1 = dedent`
        import os
        import time
        time.sleep(0.1)
        print(os.getpid())
        `;
        const fileToExecute1 = await createPythonFile(source1);

        let [pid1, pid2] = await Promise.all([
            pythonDaemonPool.exec([fileToExecute1], {}).then((out) => out.stdout.trim()),
            pythonDaemonPool.exec([fileToExecute1], {}).then((out) => out.stdout.trim())
        ]);

        const processesUsedToRunCode = new Set<string>();
        processesUsedToRunCode.add(pid1);
        processesUsedToRunCode.add(pid2);

        // We should have two distinct process ids, that was used to run our code.
        expect(processesUsedToRunCode.size).to.equal(2);

        // Ok, wait for daemons to go back into the pool.
        await sleep(1);

        // Kill one of the daemons (let it die while running some code).
        const source2 = dedent`
        import os
        os.kill(os.getpid(), 1)
        `;
        const fileToExecute2 = await createPythonFile(source2);
        [pid1, pid2] = await Promise.all([
            pythonDaemonPool
                .exec([fileToExecute1], {})
                .then((out) => out.stdout.trim())
                .catch(() => 'FAILED'),
            pythonDaemonPool
                .exec([fileToExecute2], {})
                .then((out) => out.stdout.trim())
                .catch(() => 'FAILED')
        ]);

        // Confirm that one of the executions failed due to an error.
        expect(pid1 === 'FAILED' ? pid1 : pid2).to.equal('FAILED');
        // Keep track of the process that worked.
        processesUsedToRunCode.add(pid1 === 'FAILED' ? pid2 : pid1);
        // We should still have two distinct process ids (one of the eralier processes died).
        expect(processesUsedToRunCode.size).to.equal(2);

        // Wait for a new daemon to be created.
        await waitForCondition(
            async () => createDaemonServicesSpy.callCount - daemonsCreated === 1,
            5_000,
            'Failed to create a new daemon'
        );

        // Confirm we have two daemons by checking the Pids again.
        // One of them will be new.
        [pid1, pid2] = await Promise.all([
            pythonDaemonPool.exec([fileToExecute1], {}).then((out) => out.stdout.trim()),
            pythonDaemonPool.exec([fileToExecute1], {}).then((out) => out.stdout.trim())
        ]);

        // Keep track of the pids.
        processesUsedToRunCode.add(pid1);
        processesUsedToRunCode.add(pid2);

        // Confirm we have a total of three process ids (for 3 daemons).
        // 2 for earlier, then one died and a new one was created.
        expect(processesUsedToRunCode.size).to.be.greaterThan(2);
    }).timeout(10_000);
});
