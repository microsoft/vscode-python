// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import * as sinon from 'sinon';
import { Observable } from 'rxjs/Observable';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestExecutionAdapter } from '../../../../client/testing/testController/unittest/testExecutionAdapter';
import * as util from '../../../../client/testing/testController/common/utils';
import { IPythonExecutionFactory, IPythonExecutionService, Output } from '../../../../client/common/process/types';
import { MockChildProcess } from '../../../mocks/mockChildProcess';

suite('Unittest test execution adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;
    let execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
    let execService: typemoq.IMock<IPythonExecutionService>;
    let mockProc: MockChildProcess;

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
        outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
        sinon.stub(util, 'startTestIdServer').returns(Promise.resolve(54321));

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService = typemoq.Mock.ofType<IPythonExecutionService>();
        execService
            .setup((x) => x.execObservable(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: output,
                dispose: () => {
                    /* no-body */
                },
            }));

        execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typemoq.It.isAny()))
            .returns(() =>
                // deferred2.resolve();
                Promise.resolve(execService.object),
            );
    });
    teardown(() => {
        sinon.restore();
    });

    test('runTests should send the run command to the test server', async () => {
        let options: TestCommandOptions | undefined;
        const errorBool = false;
        const errorMessage = '';

        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'execution.py');

        const adapter = new UnittestTestExecutionAdapter(stubConfigSettings, outputChannel.object);
        const testIds = ['test1id', 'test2id'];
        adapter.runTests(uri, testIds, false, undefined, execFactory.object).then(() => {
            const expectedOptions: TestCommandOptions = {
                workspaceFolder: uri,
                command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
                cwd: uri.fsPath,
                debugBool: false,
                testIds,
            };
            assert.deepStrictEqual(options, expectedOptions);
            assert.equal(errorBool, false, errorMessage);
        });
    });
    test('runTests should respect settings.testing.cwd when present', async () => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'], cwd: '/foo' },
            }),
        } as unknown) as IConfigurationService;
        let options: TestCommandOptions | undefined;
        const errorBool = false;
        const errorMessage = '';

        const newCwd = '/foo';
        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'execution.py');

        const adapter = new UnittestTestExecutionAdapter(stubConfigSettings, outputChannel.object);
        const testIds = ['test1id', 'test2id'];
        adapter.runTests(uri, testIds, false, undefined, execFactory.object).then(() => {
            const expectedOptions: TestCommandOptions = {
                workspaceFolder: uri,
                command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
                cwd: newCwd,
                debugBool: false,
                testIds,
            };
            assert.deepStrictEqual(options, expectedOptions);
            assert.equal(errorBool, false, errorMessage);
        });
    });
});
