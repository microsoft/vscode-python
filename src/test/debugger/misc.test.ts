// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { IS_CI_SERVER, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';

const isProcessRunning = require('is-running') as (number) => boolean;

use(chaiAsPromised);

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');
const MAX_SIGNED_INT32 = Math.pow(2, 31) - 1;
const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'mainV2.js');

[DEBUG_ADAPTER, EXPERIMENTAL_DEBUG_ADAPTER].forEach(testAdapterFilePath => {
    const debugAdapterFileName = path.basename(testAdapterFilePath);
    const debuggerType = debugAdapterFileName === 'Main.js' ? 'python' : 'pythonExperimental';
    suite(`Standard Debugging - Misc tests: ${debuggerType}`, () => {

        let debugClient: DebugClient;
        setup(async function () {
            if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
                this.skip();
            }
            // Temporary, untill new version of PTVSD is bundled we cannot run tests
            if (debuggerType !== 'python' && IS_CI_SERVER) {
                return this.skip();
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            debugClient = new DebugClient('node', testAdapterFilePath, debuggerType);
            await debugClient.start();
        });
        teardown(async () => {
            // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
            await sleep(1000);
            try {
                // tslint:disable-next-line:no-empty
                await debugClient.stop().catch(() => { });
                // tslint:disable-next-line:no-empty
            } catch (ex) { }
            await sleep(1000);
        });

        function buildLauncArgs(pythonFile: string, stopOnEntry: boolean = false): LaunchRequestArguments {
            // Temporary, untill new version of PTVSD is bundled we cannot run tests.
            // For now lets run test locally.
            const pythonPath = debuggerType === 'python' ? 'python' : '/Users/donjayamanne/Desktop/Development/PythonStuff/IssueRepos/debuggerTests/.envp36/bin/python';
            const env = debuggerType === 'python' ? {} : { PYTHONPATH: '/Users/donjayamanne/Desktop/Development/PythonStuff/IssueRepos/expPTVSD/ptvsd' };
            return {
                program: path.join(debugFilesPath, pythonFile),
                cwd: debugFilesPath,
                stopOnEntry,
                debugOptions: ['RedirectOutput'],
                pythonPath,
                args: [],
                env,
                envFile: '',
                logToFile: false,
                type: debuggerType
            };
        }

        test('Should run program to the end', async () => {
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('simplePrint.py', false)),
                debugClient.waitForEvent('initialized'),
                debugClient.waitForEvent('terminated')
            ]);
        });
        test('Should stop on entry', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('simplePrint.py', true)),
                debugClient.waitForEvent('initialized'),
                debugClient.waitForEvent('stopped')
            ]);
        });
        test('test stderr output', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('stdErrOutput.py', false)),
                debugClient.waitForEvent('initialized'),
                //TODO: ptvsd does not differentiate.
                debugClient.assertOutput('stdout', 'error output'),
                debugClient.waitForEvent('terminated')
            ]);
        });
        test('Test stdout output', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('stdOutOutput.py', false)),
                debugClient.waitForEvent('initialized'),
                debugClient.assertOutput('stdout', 'normal output'),
                debugClient.waitForEvent('terminated')
            ]);
        });
        test('Should run program to the end (with stopOnEntry=true and continue)', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('simplePrint.py', true)),
                debugClient.waitForEvent('initialized'),
                debugClient.waitForEvent('stopped')
            ]);

            const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
            await Promise.all([
                debugClient.continueRequest({ threadId }),
                debugClient.waitForEvent('terminated')
            ]);
        });
        test('Ensure threadid is int32', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('simplePrint.py', true)),
                debugClient.waitForEvent('initialized'),
                debugClient.waitForEvent('stopped')
            ]);

            const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
            expect(threadId).to.be.lessThan(MAX_SIGNED_INT32 + 1, 'ThreadId is not an integer');
            await Promise.all([
                debugClient.continueRequest({ threadId }),
                debugClient.waitForEvent('terminated')
            ]);
        });
        test('Should break at print statement (line 3)', async () => {
            const launchArgs = buildLauncArgs('sample2.py', false);
            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.hitBreakpoint(launchArgs, breakpointLocation);
        });
        test('Should kill python process when ending debug session', async function () {
            if (debuggerType === 'python') {
                return this.skip();
            }
            const launchArgs = buildLauncArgs('sample2.py', false);
            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            const processPromise = debugClient.waitForEvent('process') as Promise<DebugProtocol.ProcessEvent>;
            await debugClient.hitBreakpoint(launchArgs, breakpointLocation);
            const processInfo = await processPromise;
            const processId = processInfo.body.systemProcessId;
            expect(processId).to.be.greaterThan(0, 'Invalid process id');

            await debugClient.stop();
            await sleep(1000);

            // Confirm the process is dead
            expect(isProcessRunning(processId)).to.be.equal(false, 'Python (debugee) Process is still alive');
        });
        test('Test conditional breakpoints', async () => {
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('forever.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'forever.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column, condition: 'i == 3' }],
                source: { path: breakpointLocation.path }
            });
            await sleep(1);
            await threadIdPromise;
            const frames = await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            // Wait for breakpoint to hit
            const frameId = frames.body.stackFrames[0].id;
            const scopes = await debugClient.scopesRequest({ frameId });

            expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
            const variablesReference = scopes.body.scopes[0].variablesReference;
            const variables = await debugClient.variablesRequest({ variablesReference });

            const vari = variables.body.variables.find(item => item.name === 'i')!;
            expect(vari).to.be.not.equal('undefined', 'variable \'i\' is undefined');
            expect(vari.value).to.be.equal('3');
        });
        test('Test variables', async () => {
            const threadIdPromise = debugClient.waitForEvent('thread');
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample2.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            await threadIdPromise;
            const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            // Wait for breakpoint to hit
            const frameId = (await stackFramesPromise).body.stackFrames[0].id;
            const scopes = await debugClient.scopesRequest({ frameId });

            expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
            const variablesReference = scopes.body.scopes[0].variablesReference;
            const variables = await debugClient.variablesRequest({ variablesReference });

            const vara = variables.body.variables.find(item => item.name === 'a')!;
            const varb = variables.body.variables.find(item => item.name === 'b')!;
            const varfile = variables.body.variables.find(item => item.name === '__file__')!;
            const vardoc = variables.body.variables.find(item => item.name === '__doc__')!;
            expect(vara).to.be.not.equal('undefined', 'variable \'a\' is undefined');
            expect(vara.value).to.be.equal('1');
            expect(varb).to.be.not.equal('undefined', 'variable \'b\' is undefined');
            expect(varb.value).to.be.equal('2');
            expect(varfile).to.be.not.equal('undefined', 'variable \'__file__\' is undefined');
            expect(path.normalize(varfile.value)).to.be.equal(`'${path.normalize(path.join(debugFilesPath, 'sample2.py'))}'`);
            expect(vardoc).to.be.not.equal('undefined', 'variable \'__doc__\' is undefined');
        });
        test('Test editing variables', async () => {
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample2.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            // const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
            const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            // Wait for breakpoint to hit
            const frameId = (await stackFramesPromise).body.stackFrames[0].id;
            const scopes = await debugClient.scopesRequest({ frameId });

            expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
            const variablesReference = scopes.body.scopes[0].variablesReference;
            const variables = await debugClient.variablesRequest({ variablesReference });
            const vara = variables.body.variables.find(item => item.name === 'a')!;
            expect(vara).to.be.not.equal('undefined', 'variable \'a\' is undefined');
            expect(vara.value).to.be.equal('1');

            const response = await debugClient.setVariableRequest({ variablesReference, name: 'a', value: '1234' });
            expect(response.success).to.be.equal(true, 'settting variable failed');
            expect(response.body.value).to.be.equal('1234');
        });
        test('Test evaluating expressions', async () => {
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample2.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            await threadIdPromise;
            const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            // Wait for breakpoint to hit
            const frameId = (await stackFramesPromise).body.stackFrames[0].id;
            const response = await debugClient.evaluateRequest({ frameId, expression: '(a+b)*2' });

            expect(response.success).to.be.equal(true, 'variable evaluation failed');
            expect(response.body.result).to.be.equal('6', 'expression value is incorrect');
        });
        test('Test stepover', async () => {
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample2.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            // hit breakpoint.
            const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
            await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            await debugClient.nextRequest({ threadId });
            const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 7 };
            await debugClient.assertStoppedLocation('step', functionLocation);

            await debugClient.nextRequest({ threadId });
            const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 11 };
            await debugClient.assertStoppedLocation('step', functionInvocationLocation);

            await debugClient.nextRequest({ threadId });
            const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 13 };
            await debugClient.assertStoppedLocation('step', printLocation);
        });
        test('Test stepin and stepout', async () => {
            const threadIdPromise = debugClient.waitForEvent('thread');

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample2.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            // hit breakpoint.
            await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
            const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;

            await debugClient.nextRequest({ threadId });
            const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 7 };
            await debugClient.assertStoppedLocation('step', functionLocation);

            await debugClient.nextRequest({ threadId });
            const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 11 };
            await debugClient.assertStoppedLocation('step', functionInvocationLocation);

            await debugClient.stepInRequest({ threadId });
            const loopPrintLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 8 };
            await debugClient.assertStoppedLocation('step', loopPrintLocation);

            await debugClient.stepOutRequest({ threadId });
            await debugClient.assertStoppedLocation('step', functionInvocationLocation);

            await debugClient.nextRequest({ threadId });
            const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 13 };
            await debugClient.assertStoppedLocation('step', printLocation);
        });
        test('Test pausing', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }

            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('forever.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            await sleep(3);
            const pauseLocation = { path: path.join(debugFilesPath, 'forever.py'), line: 5 };
            const pausePromise = debugClient.assertStoppedLocation('pause', pauseLocation);
            const threads = await debugClient.threadsRequest();
            expect(threads).to.be.not.equal(undefined, 'no threads response');
            expect(threads.body.threads).to.be.lengthOf(1);
            await debugClient.pauseRequest({ threadId: threads.body.threads[0].id });
            await pausePromise;
        });
        test('Test pausing on exceptions', async function () {
            if (debuggerType !== 'python') {
                return this.skip();
            }
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('sample3WithEx.py', false)),
                debugClient.waitForEvent('initialized')
            ]);

            const pauseLocation = { path: path.join(debugFilesPath, 'sample3WithEx.py'), line: 5 };
            await debugClient.assertStoppedLocation('exception', pauseLocation);
        });
        test('Test multi-threaded debugging', async () => {
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('multiThread.py', false)),
                debugClient.waitForEvent('initialized')
            ]);
            const pythonFile = path.join(debugFilesPath, 'multiThread.py');
            const breakpointLocation = { path: pythonFile, column: 1, line: 11 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            // hit breakpoint.
            await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            const threads = await debugClient.threadsRequest();
            expect(threads.body.threads).of.lengthOf(2, 'incorrect number of threads');
            for (const thread of threads.body.threads) {
                expect(thread.id).to.be.lessThan(MAX_SIGNED_INT32 + 1, 'ThreadId is not an integer');
            }
        });
        test('Test stack frames', async () => {
            await Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLauncArgs('stackFrame.py', false)),
                debugClient.waitForEvent('initialized')
            ]);
            const pythonFile = path.join(debugFilesPath, 'stackFrame.py');
            const breakpointLocation = { path: pythonFile, column: 1, line: 5 };
            await debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });

            // hit breakpoint.
            const stackframes = await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

            expect(stackframes.body.stackFrames[0].line).to.be.equal(5);
            expect(stackframes.body.stackFrames[0].source!.path).to.be.equal(pythonFile);
            expect(stackframes.body.stackFrames[0].name).to.be.equal('foo');

            expect(stackframes.body.stackFrames[1].line).to.be.equal(8);
            expect(stackframes.body.stackFrames[1].source!.path).to.be.equal(pythonFile);
            expect(stackframes.body.stackFrames[1].name).to.be.equal('bar');

            expect(stackframes.body.stackFrames[2].line).to.be.equal(10);
            expect(stackframes.body.stackFrames[2].source!.path).to.be.equal(pythonFile);
        });
    });
});
