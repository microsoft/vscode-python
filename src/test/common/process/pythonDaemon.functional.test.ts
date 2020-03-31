// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect, use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import * as dedent from 'dedent';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import {
    createMessageConnection,
    MessageConnection,
    RequestType,
    StreamMessageReader,
    StreamMessageWriter
} from 'vscode-jsonrpc';
import { PythonDaemonExecutionService } from '../../../client/common/process/pythonDaemon';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { IPythonExecutionService, PythonVersionInfo } from '../../../client/common/process/types';
import { IDisposable } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { parsePythonVersion } from '../../../client/common/utils/version';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { isPythonVersion, PYTHON_PATH } from '../../common';
import { createTemporaryFile } from '../../utils/fs';
use(chaiPromised);

// tslint:disable-next-line: max-func-body-length
suite('Daemon', () => {
    // Set PYTHONPATH to pickup our module and the jsonrpc modules.
    const envPythonPath = `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(
        EXTENSION_ROOT_DIR,
        'pythonFiles',
        'lib',
        'python'
    )}`;
    const env = { PYTHONPATH: envPythonPath, PYTHONUNBUFFERED: '1' };
    let pythonProc: ChildProcess;
    let connection: MessageConnection;
    let fullyQualifiedPythonPath: string = PYTHON_PATH;
    let pythonDaemon: PythonDaemonExecutionService;
    let pythonExecutionService: IPythonExecutionService;
    let disposables: IDisposable[] = [];
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
        // Enable the following to log everything going on at pyton end.
        // pythonProc = spawn(fullyQualifiedPythonPath, ['-m', 'vscode_datascience_helpers.daemon', '-v', `--log-file=${path.join(EXTENSION_ROOT_DIR, 'test.log')}`], { env });
        pythonProc = spawn(fullyQualifiedPythonPath, ['-m', 'vscode_datascience_helpers.daemon'], { env });
        connection = createMessageConnection(
            new StreamMessageReader(pythonProc.stdout),
            new StreamMessageWriter(pythonProc.stdin)
        );
        connection.listen();
        pythonExecutionService = mock(PythonExecutionService);
        pythonDaemon = new PythonDaemonExecutionService(
            instance(pythonExecutionService),
            fullyQualifiedPythonPath,
            pythonProc,
            connection
        );
    });
    teardown(() => {
        pythonProc.kill();
        if (connection) {
            connection.dispose();
        }
        pythonDaemon.dispose();
        disposables.forEach((item) => item.dispose());
        disposables = [];
    });

    async function createPythonFile(source: string): Promise<string> {
        const tmpFile = await createTemporaryFile('.py');
        disposables.push({ dispose: () => tmpFile.cleanupCallback() });
        await fs.writeFile(tmpFile.filePath, source, { encoding: 'utf8' });
        return tmpFile.filePath;
    }

    test('Ping', async () => {
        const data = 'Hello World';
        const request = new RequestType<{ data: string }, { pong: string }, void, void>('ping');
        const result = await connection.sendRequest(request, { data });
        assert.equal(result.pong, data);
    });

    test('Ping with Unicode', async () => {
        const data = 'Hello World-₹-😄';
        const request = new RequestType<{ data: string }, { pong: string }, void, void>('ping');
        const result = await connection.sendRequest(request, { data });
        assert.equal(result.pong, data);
    });

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

        const version = await pythonDaemon.getInterpreterInformation();

        assert.deepEqual(version, expectedVersion);
    });

    test('Executable path', async () => {
        const execPath = await pythonDaemon.getExecutablePath();

        assert.deepEqual(execPath, fullyQualifiedPythonPath);
    });

    async function testModuleInstalled(moduleName: string, expectedToBeInstalled: boolean) {
        await assert.eventually.equal(pythonDaemon.isModuleInstalled(moduleName), expectedToBeInstalled);
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
        const output = await pythonDaemon.exec([fileToExecute], {});

        assert.isUndefined(output.stderr);
        assert.deepEqual(output.stdout, 'HELLO WORLD-₹-😄');
    });

    test('Execute a file and capture stderr (with unicode)', async () => {
        const source = dedent`
        import sys
        sys.stderr.write("HELLO WORLD-₹-😄")
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemon.exec([fileToExecute], {});

        assert.isUndefined(output.stdout);
        assert.deepEqual(output.stderr, 'HELLO WORLD-₹-😄');
    });

    test('Execute a file with arguments', async () => {
        const source = dedent`
        import sys
        sys.stdout.write(sys.argv[1])
        `;
        const fileToExecute = await createPythonFile(source);
        const output = await pythonDaemon.exec([fileToExecute, 'HELLO WORLD'], {});

        assert.isUndefined(output.stderr);
        assert.equal(output.stdout, 'HELLO WORLD');
    });

    test('Execute a file with custom cwd', async () => {
        const source = dedent`
        import os
        print(os.getcwd())
        `;
        const fileToExecute = await createPythonFile(source);
        const output1 = await pythonDaemon.exec([fileToExecute, 'HELLO WORLD'], { cwd: EXTENSION_ROOT_DIR });

        assert.isUndefined(output1.stderr);
        assert.equal(output1.stdout.trim(), EXTENSION_ROOT_DIR);

        const output2 = await pythonDaemon.exec([fileToExecute, 'HELLO WORLD'], { cwd: __dirname });

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
        const output = await pythonDaemon.exec([fileToExecute, 'HELLO WORLD'], {});

        assert.equal(output.stdout, 'HELLO WORLD-₹-😄');
        assert.equal(output.stderr, 'FOO BAR-₹-😄');
    });

    test('Execute a file and handle error', async () => {
        const source = dedent`
        import sys
        raise Exception("KABOOM")
        `;
        const fileToExecute = await createPythonFile(source);
        const promise = pythonDaemon.exec([fileToExecute], {});
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    });

    test('Execute a file with custom env variable', async () => {
        const source = dedent`
        import os
        print(os.getenv("VSC_HELLO_CUSTOM", "NONE"))
        `;
        const fileToExecute = await createPythonFile(source);

        const output1 = await pythonDaemon.exec([fileToExecute], {});

        // Confirm there's no custom variable.
        assert.equal(output1.stdout.trim(), 'NONE');

        // Confirm setting the varible works.
        const output2 = await pythonDaemon.exec([fileToExecute], { env: { VSC_HELLO_CUSTOM: 'wow' } });
        assert.equal(output2.stdout.trim(), 'wow');
    });

    test('Execute simple module', async () => {
        const pipVersion = spawnSync(fullyQualifiedPythonPath, ['-c', 'import pip;print(pip.__version__)'])
            .stdout.toString()
            .trim();

        const output = await pythonDaemon.execModule('pip', ['--version'], {});

        assert.isUndefined(output.stderr);
        assert.equal(output.stdout.trim(), pipVersion);
    });

    test('Execute a file and stream output', async () => {
        const source = dedent`
        import sys
        import time
        for i in range(5):
            print(i)
            time.sleep(1)
        `;
        const fileToExecute = await createPythonFile(source);
        const output = pythonDaemon.execObservable([fileToExecute], {});
        const outputsReceived: string[] = [];
        await new Promise((resolve, reject) => {
            output.out.subscribe((out) => outputsReceived.push(out.out.trim()), reject, resolve);
        });
        assert.deepEqual(
            outputsReceived.filter((item) => item.length > 0),
            ['0', '1', '2', '3', '4']
        );
    }).timeout(10_000);

    test('Execute a file and throw exception if stderr is not empty', async () => {
        const fileToExecute = await createPythonFile(['import sys', 'sys.stderr.write("KABOOM")'].join(os.EOL));
        const promise = pythonDaemon.exec([fileToExecute], { throwOnStdErr: true });
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    });

    test('Execute a file and throw exception if stderr is not empty when streaming output', async () => {
        const source = dedent`
        import sys
        import time
        time.sleep(1)
        sys.stderr.write("KABOOM")
        sys.stderr.flush()
        time.sleep(1)
        `;
        const fileToExecute = await createPythonFile(source);
        const output = pythonDaemon.execObservable([fileToExecute], { throwOnStdErr: true });
        const outputsReceived: string[] = [];
        const promise = new Promise((resolve, reject) => {
            output.out.subscribe((out) => outputsReceived.push(out.out.trim()), reject, resolve);
        });
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
    }).timeout(3_000);
});
