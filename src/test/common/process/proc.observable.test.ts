// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { CancellationTokenSource } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { initialize } from './../../initialize';

use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length
suite('ProcessService', () => {
    let pythonPath: string;
    suiteSetup(() => {
        pythonPath = PythonSettings.getInstance().pythonPath;
        return initialize();
    });
    setup(initialize);
    teardown(initialize);

    test('execObservable should output print statements', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const printOutput = '1234';
        const result = procService.execObservable(pythonPath, ['-c', `print("${printOutput}")`]);

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const output = await result.out.toPromise();
        expect(output.source).to.be.equal('stdout', 'Source is incorrect');
        expect(output.out).to.have.length.greaterThan(0, 'Invalid output length');
        const stdOut = output.out.trim();
        expect(stdOut).to.equal(printOutput, 'Output is incorrect');
    });

    test('execObservable should stream output with new lines', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(5000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'print("3")'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const expectedValue = outputs.shift();
            if (expectedValue !== output.out.trim() || expectedValue === output.out) {
                done(`Received value ${output.out} is not same as the expectd value ${expectedValue}`);
            }
            if (output.source !== 'stdout') {
                done(`Source is not stdout. Value received is ${output.source}`);
            }
        }, done, done);
    });

    test('execObservable should stream output without new lines', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(5000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'sys.stdout.write("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stdout.write("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stdout.write("3")'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const expectedValue = outputs.shift();
            if (expectedValue !== output.out) {
                done(`Received value ${output.out} is not same as the expectd value ${expectedValue}`);
            }
            if (output.source !== 'stdout') {
                done(`Source is not stdout. Value received is ${output.source}`);
            }
        }, done, done);
    });

    test('execObservable should end when cancellationToken is cancelled', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(10)',
            'print("2")', 'sys.stdout.flush()'];
        const cancellationToken = new CancellationTokenSource();
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            if (value === '1') {
                cancellationToken.cancel();
            } else {
                done('Output received when we shouldn\'t have.');
            }
        }, done, () => {
            const errorMsg = cancellationToken.token.isCancellationRequested ? undefined : 'Program terminated even before cancelling it.';
            done(errorMsg);
        });
    });

    test('execObservable should end when process is killed', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(10)',
            'print("2")', 'sys.stdout.flush()'];
        const cancellationToken = new CancellationTokenSource();
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });
        let procKilled = false;

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            if (value === '1') {
                procKilled = true;
                result.proc.kill();
            } else {
                done('Output received when we shouldn\'t have.');
            }
        }, done, () => {
            const errorMsg = procKilled ? undefined : 'Program terminated even before killing it.';
            done(errorMsg);
        });
    });

    test('execObservable should stream stdout and stderr separately', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(7000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("3")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("c")', 'sys.stderr.flush()'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = [
            { out: '1', source: 'stdout' }, { out: 'a', source: 'stderr' },
            { out: '2', source: 'stdout' }, { out: 'b', source: 'stderr' },
            { out: '3', source: 'stdout' }, { out: 'c', source: 'stderr' }];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            const expectedOutput = outputs.shift()!;

            expect(value).to.be.equal(expectedOutput.out, 'Expected output is incorrect');
            expect(output.source).to.be.equal(expectedOutput.source, 'Expected sopurce is incorrect');
        }, done, done);
    });

    test('execObservable should merge stdout and stderr streams', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(7000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("3")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("c")', 'sys.stderr.flush()'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { mergeStdOutErr: true });
        const outputs = [
            { out: '1', source: 'stdout' }, { out: 'a', source: 'stdout' },
            { out: '2', source: 'stdout' }, { out: 'b', source: 'stdout' },
            { out: '3', source: 'stdout' }, { out: 'c', source: 'stdout' }];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            const expectedOutput = outputs.shift()!;

            expect(value).to.be.equal(expectedOutput.out, 'Expected output is incorrect');
            expect(output.source).to.be.equal(expectedOutput.source, 'Expected sopurce is incorrect');
        }, done, done);
    });

    test('execObservable should throw an error with stderr output', (done) => {
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'sys.stderr.write("a")', 'sys.stderr.flush()'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { throwOnStdErr: true });

        expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done('Output received, when we\'re expecting an error to be thrown.');
        }, (ex: Error) => {
            expect(ex).to.have.property('message', 'a', 'Invalid error thrown');
            done();
        }, () => {
            done('Completed, when we\'re expecting an error to be thrown.');
        });
    });

    test('execObservable should throw an error when spawn file not found', (done) => {
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.execObservable(Date.now().toString(), []);

        expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done('Output received, when we\'re expecting an error to be thrown.');
        }, ex => {
            expect(ex).to.have.property('code', 'ENOENT', 'Invalid error code');
            done();
        }, () => {
            done('Completed, when we\'re expecting an error to be thrown.');
        });
    });

    test('execObservable should exit without no output', (done) => {
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.execObservable(pythonPath, ['-c', 'import sys', 'sys.exit()']);

        expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done(`Output received, when we\'re not expecting any, ${JSON.stringify(output)}`);
        }, done, done);
    });
});
