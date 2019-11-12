// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { CancellationTokenSource } from 'vscode';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { StdErrError } from '../../../client/common/process/types';
import { OSType } from '../../../client/common/utils/platform';
import { getExtensionSettings, isOs, isPythonVersion } from '../../common';
import { initialize } from './../../initialize';

use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length
suite('ProcessService Observable', () => {
    let pythonPath: string;
    suiteSetup(() => {
        pythonPath = getExtensionSettings(undefined).pythonPath;
        return initialize();
    });
    setup(initialize);
    teardown(initialize);

    test('exec should output print statements', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const printOutput = '1234';
        const result = await procService.exec(pythonPath, ['-c', `print("${printOutput}")`]);

        expect(result).not.to.be.an('undefined', 'result is undefined');
        expect(result.stdout.trim()).to.be.equal(printOutput, 'Invalid output');
        expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    });

    test('exec should output print unicode characters', async function() {
        // This test has not been working for many months in Python 2.7 under
        // Windows. Tracked by #2546. (unicode under Py2.7 is tough!)
        if (isOs(OSType.Windows) && (await isPythonVersion('2.7'))) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }

        const procService = new ProcessService(new BufferDecoder());
        const printOutput = 'öä';
        const result = await procService.exec(pythonPath, ['-c', `print("${printOutput}")`]);

        expect(result).not.to.be.an('undefined', 'result is undefined');
        expect(result.stdout.trim()).to.be.equal(printOutput, 'Invalid output');
        expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    });

    test('exec should wait for completion of program with new lines', async function() {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(5000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time', 'print("1")', 'sys.stdout.flush()', 'time.sleep(1)', 'print("2")', 'sys.stdout.flush()', 'time.sleep(1)', 'print("3")'];
        const result = await procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const values = result.stdout
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(values).to.deep.equal(outputs, 'Output values are incorrect');
        expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    });

    test('exec should wait for completion of program without new lines', async function() {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(5000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = [
            'import sys',
            'import time',
            'sys.stdout.write("1")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stdout.write("2")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stdout.write("3")'
        ];
        const result = await procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['123'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const values = result.stdout
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(values).to.deep.equal(outputs, 'Output values are incorrect');
        expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    });

    test('exec should end when cancellationToken is cancelled', async function() {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time', 'print("1")', 'sys.stdout.flush()', 'time.sleep(10)', 'print("2")', 'sys.stdout.flush()'];
        const cancellationToken = new CancellationTokenSource();
        setTimeout(() => cancellationToken.cancel(), 3000);

        const result = await procService.exec(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const values = result.stdout
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(values).to.deep.equal(['1'], 'Output values are incorrect');
        expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    });

    test('exec should stream stdout and stderr separately', async function() {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(7000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = [
            'import sys',
            'import time',
            'print("1")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("a")',
            'sys.stderr.flush()',
            'time.sleep(1)',
            'print("2")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("b")',
            'sys.stderr.flush()',
            'time.sleep(1)',
            'print("3")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("c")',
            'sys.stderr.flush()'
        ];
        const result = await procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
        const expectedStdout = ['1', '2', '3'];
        const expectedStderr = ['abc'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const stdouts = result.stdout
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(stdouts).to.deep.equal(expectedStdout, 'stdout values are incorrect');
        const stderrs = result
            .stderr!.split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(stderrs).to.deep.equal(expectedStderr, 'stderr values are incorrect');
    });

    test('exec should merge stdout and stderr streams', async function() {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(7000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = [
            'import sys',
            'import time',
            'sys.stdout.write("1")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("a")',
            'sys.stderr.flush()',
            'time.sleep(1)',
            'sys.stdout.write("2")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("b")',
            'sys.stderr.flush()',
            'time.sleep(1)',
            'sys.stdout.write("3")',
            'sys.stdout.flush()',
            'time.sleep(1)',
            'sys.stderr.write("c")',
            'sys.stderr.flush()'
        ];
        const result = await procService.exec(pythonPath, ['-c', pythonCode.join(';')], { mergeStdOutErr: true });
        const expectedOutput = ['1a2b3c'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const outputs = result.stdout
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        expect(outputs).to.deep.equal(expectedOutput, 'Output values are incorrect');
    });

    test('exec should throw an error with stderr output', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'sys.stderr.write("a")', 'sys.stderr.flush()'];
        const result = procService.exec(pythonPath, ['-c', pythonCode.join(';')], { throwOnStdErr: true });

        await expect(result).to.eventually.be.rejectedWith(StdErrError, 'a', 'Expected error to be thrown');
    });

    test('exec should throw an error when spawn file not found', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.exec(Date.now().toString(), []);

        await expect(result).to.eventually.be.rejected.and.to.have.property('code', 'ENOENT', 'Invalid error code');
    });

    test('exec should exit without no output', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const result = await procService.exec(pythonPath, ['-c', 'import sys', 'sys.exit()']);

        expect(result.stdout).equals('', 'stdout is invalid');
        expect(result.stderr).equals(undefined, 'stderr is invalid');
    });
    test('shellExec should be able to run python too', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const printOutput = '1234';
        const result = await procService.shellExec(`"${pythonPath}" -c "print('${printOutput}')"`);

        expect(result).not.to.be.an('undefined', 'result is undefined');
        expect(result.stderr).to.equal(undefined, 'stderr not empty');
        expect(result.stdout.trim()).to.be.equal(printOutput, 'Invalid output');
    });
    test('shellExec should fail on invalid command', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.shellExec('invalid command');
        await expect(result).to.eventually.be.rejectedWith(Error, 'a', 'Expected error to be thrown');
    });
});
