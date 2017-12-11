import * as assert from 'assert';
import { EOL } from 'os';
import * as vscode from 'vscode';
import { createDeferred } from '../../client/common/helpers';
import { execPythonFile, getInterpreterVersion } from '../../client/common/utils';
import { initialize } from './../initialize';

// Defines a Mocha test suite to group tests of similar kind together
suite('ChildProc', () => {
    setup(initialize);
    teardown(initialize);
    test('Standard Response', done => {
        execPythonFile(undefined, 'python', ['-c', 'print(1)'], __dirname, false).then(data => {
            assert.ok(data === `1${EOL}`);
        }).then(done).catch(done);
    });
    test('Error Response', done => {
        // tslint:disable-next-line:no-any
        const def = createDeferred<any>();
        execPythonFile(undefined, 'python', ['-c', 'print(1'], __dirname, false).then(() => {
            def.reject('Should have failed');
        }).catch(() => {
            def.resolve();
        });

        def.promise.then(done).catch(done);
    });

    test('Stream Stdout', done => {
        const output: string[] = [];
        function handleOutput(data: string) {
            if (data.trim().length > 0) {
                output.push(data.trim());
            }
        }
        execPythonFile(undefined, 'python', ['-c', 'print(1)'], __dirname, false, handleOutput).then(() => {
            assert.equal(output.length, 1, 'Ouput length incorrect');
            assert.equal(output[0], '1', 'Ouput value incorrect');
        }).then(done).catch(done);
    });

    test('Stream Stdout (Unicode)', async () => {
        const output: string[] = [];
        function handleOutput(data: string) {
            if (data.trim().length > 0) {
                output.push(data.trim());
            }
        }
        await execPythonFile(undefined, 'python', ['-c', 'print(\'öä\')'], __dirname, false, handleOutput);
        assert.equal(output.length, 1, 'Ouput length incorrect');
        assert.equal(output[0], 'öä', 'Ouput value incorrect');
    });

    test('Stream Stdout with Threads', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(6000);
        const output: string[] = [];
        function handleOutput(data: string) {
            if (data.trim().length > 0) {
                output.push(data.trim());
            }
        }
        execPythonFile(undefined, 'python', ['-c', 'import sys\nprint(1)\nsys.__stdout__.flush()\nimport time\ntime.sleep(5)\nprint(2)'], __dirname, false, handleOutput).then(() => {
            assert.equal(output.length, 2, 'Ouput length incorrect');
            assert.equal(output[0], '1', 'First Ouput value incorrect');
            assert.equal(output[1], '2', 'Second Ouput value incorrect');
        }).then(done).catch(done);
    });

    test('Kill', done => {
        // tslint:disable-next-line:no-any
        const def = createDeferred<any>();
        const output: string[] = [];
        function handleOutput(data: string) {
            if (data.trim().length > 0) {
                output.push(data.trim());
            }
        }
        const cancellation = new vscode.CancellationTokenSource();
        execPythonFile(undefined, 'python', ['-c', 'import sys\nprint(1)\nsys.__stdout__.flush()\nimport time\ntime.sleep(5)\nprint(2)'], __dirname, false, handleOutput, cancellation.token).then(() => {
            def.reject('Should not have completed');
        }).catch(() => {
            def.resolve();
        });

        setTimeout(() => {
            cancellation.cancel();
        }, 1000);

        def.promise.then(done).catch(done);
    });

    test('Get Python display name', async () => {
        const displayName = await getInterpreterVersion('python');
        assert.equal(typeof displayName, 'string', 'Display name not returned');
        assert.notEqual(displayName.length, 0, 'Display name cannot be empty');
    });
});
