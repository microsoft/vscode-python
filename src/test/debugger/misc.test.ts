// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import { expect } from 'chai';
import * as path from 'path';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PlatformService } from '../../client/common/platform/platformService';
import { PTVSD_PATH, DebuggerTypeName } from '../../client/debugger/Common/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { DebugClientEx } from './debugClient';
import { continueDebugging } from './utils';

const isProcessRunning = require('is-running') as (number) => boolean;

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const MAX_SIGNED_INT32 = Math.pow(2, 31) - 1;
const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'mainV2.js');

let testCounter = 0;
const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = DebuggerTypeName;
suite(`Standard Debugging - Misc tests: ${debuggerType}`, () => {

    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = createDebugAdapter();
        debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
        await debugClient.start();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            await debugClient.stop().catch(noop);
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
        await sleep(1000);
    });
    /**
     * Creates the debug adapter.
     * We do not need to support code coverage on AppVeyor, lets use the standard test adapter.
     * @returns {DebugClient}
     */
    function createDebugAdapter(): DebugClient {
        if (IS_WINDOWS) {
            return new DebugClient('node', testAdapterFilePath, debuggerType);
        } else {
            const coverageDirectory = path.join(EXTENSION_ROOT_DIR, `debug_coverage${testCounter += 1}`);
            return new DebugClientEx(testAdapterFilePath, debuggerType, coverageDirectory, { cwd: EXTENSION_ROOT_DIR });
        }
    }
    function buildLaunchArgs(pythonFile: string, stopOnEntry: boolean = false): LaunchRequestArguments {
        const env = { PYTHONPATH: PTVSD_PATH };
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            env,
            envFile: '',
            logToFile: false,
            type: debuggerType
        };

        return options;
    }

    test('Should run program to the end', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Should stop on entry', async function () {
        if (debuggerType === DebuggerTypeName) {
            return this.skip();
        }
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', true)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('stopped')
        ]);
    });
    test('test stderr output for Python', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdErrOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            //TODO: ptvsd does not differentiate.
            debugClient.assertOutput('stderr', 'error output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test stdout output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdOutOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'normal output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Should run program to the end (with stopOnEntry=true and continue)', async function () {
        if (debuggerType === DebuggerTypeName) {
            return this.skip();
        }
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', true)),
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
        if (debuggerType === DebuggerTypeName) {
            return this.skip();
        }
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', true)),
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
        const launchArgs = buildLaunchArgs('sample2.py', false);
        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 5 };
        await debugClient.hitBreakpoint(launchArgs, breakpointLocation);
    });
    test('Should kill python process when ending debug session', async () => {
        const launchArgs = buildLaunchArgs('sample2.py', false);
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
            debugClient.launch(buildLaunchArgs('forever.py', false)),
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
            debugClient.launch(buildLaunchArgs('sample2.py', false)),
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
            debugClient.launch(buildLaunchArgs('sample2.py', false)),
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
            debugClient.launch(buildLaunchArgs('sample2.py', false)),
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
            debugClient.launch(buildLaunchArgs('sample2.py', false)),
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

        const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 7 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', functionLocation)
        ]);

        const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 11 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', functionInvocationLocation)
        ]);

        const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 13 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', printLocation)
        ]);
    });
    test('Test stepin and stepout', async () => {
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('sample2.py', false)),
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

        const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 7 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', functionLocation)
        ]);

        const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 11 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', functionInvocationLocation)
        ]);

        const loopPrintLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 8 };
        await Promise.all([
            debugClient.stepInRequest({ threadId }),
            debugClient.assertStoppedLocation('step', loopPrintLocation)
        ]);

        await Promise.all([
            debugClient.stepOutRequest({ threadId }),
            debugClient.assertStoppedLocation('step', functionInvocationLocation)
        ]);

        const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 1, line: 13 };
        await Promise.all([
            debugClient.nextRequest({ threadId }),
            debugClient.assertStoppedLocation('step', printLocation)
        ]);
    });
    test('Test pausing', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('forever.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('process')
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
        if (debuggerType === DebuggerTypeName) {
            return this.skip();
        }

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('sample3WithEx.py', false)),
            debugClient.waitForEvent('initialized')
        ]);

        const pauseLocation = { path: path.join(debugFilesPath, 'sample3WithEx.py'), line: 5 };
        await debugClient.assertStoppedLocation('exception', pauseLocation);
    });
    test('Test pausing on assert failures', async () => {
        const pauseLocation = { path: path.join(debugFilesPath, 'sampleWithAssertEx.py'), line: 1 };

        function waitToStopDueToException() {
            return new Promise((resolve, reject) => {
                debugClient.once('stopped', (event: DebugProtocol.StoppedEvent) => {
                    if (event.body.reason === 'exception' &&
                        event.body.text && event.body.text!.startsWith('AssertionError')) {
                        resolve();
                    } else {
                        reject(new Error('Stopped for some other reason'));
                    }
                });
                setTimeout(() => {
                    reject(new Error(`waitToStopDueToException not received after ${debugClient.defaultTimeout} ms`));
                }, debugClient.defaultTimeout);
            });
        }

        function setBreakpointFilter(): Promise<any> {
            return debugClient.waitForEvent('initialized')
                .then(() => debugClient.setExceptionBreakpointsRequest({ filters: ['uncaught'] }))
                .then(() => debugClient.configurationDoneRequest());
        }
        await Promise.all([
            debugClient.configurationSequence(),
            setBreakpointFilter(),
            debugClient.launch(buildLaunchArgs('sampleWithAssertEx.py', false)),
            waitToStopDueToException(),
            debugClient.assertStoppedLocation('exception', pauseLocation)
        ]);
    });
    test('Test multi-threaded debugging', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('multiThread.py', false)),
            debugClient.waitForEvent('initialized')
        ]);

        // Add a delay for debugger to start (sometimes it takes a long time for new debugger to break).
        await sleep(3000);
        const pythonFile = path.join(debugFilesPath, 'multiThread.py');
        const breakpointLocation = { path: pythonFile, column: 1, line: 11 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        const threads = await debugClient.threadsRequest();
        expect(threads.body.threads).of.lengthOf(2, 'incorrect number of threads');
        for (const thread of threads.body.threads) {
            expect(thread.id).to.be.lessThan(MAX_SIGNED_INT32 + 1, 'ThreadId is not an integer');
        }
    });
    test('Test multi-threaded debugging', async function () {
        this.timeout(30000);
        await Promise.all([
            debugClient.launch(buildLaunchArgs('multiThread.py', false)),
            debugClient.waitForEvent('initialized')
        ]);

        const pythonFile = path.join(debugFilesPath, 'multiThread.py');
        const breakpointLocation = { path: pythonFile, column: 1, line: 11 };
        const breakpointRequestArgs = {
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        };

        function waitForStoppedEventFromTwoThreads() {
            return new Promise((resolve, reject) => {
                let numberOfStops = 0;
                debugClient.addListener('stopped', (event: DebugProtocol.StoppedEvent) => {
                    numberOfStops += 1;
                    if (numberOfStops < 2) {
                        return;
                    }
                    resolve(event);
                });
                setTimeout(() => reject(new Error('Timeout waiting for two threads to stop at breakpoint')), DEBUGGER_TIMEOUT);
            });
        }

        await Promise.all([
            debugClient.setBreakpointsRequest(breakpointRequestArgs),
            debugClient.setExceptionBreakpointsRequest({ filters: [] }),
            debugClient.configurationDoneRequest(),
            waitForStoppedEventFromTwoThreads(),
            debugClient.assertStoppedLocation('breakpoint', breakpointLocation)
        ]);

        const threads = await debugClient.threadsRequest();
        expect(threads.body.threads).of.lengthOf(2, 'incorrect number of threads');
        for (const thread of threads.body.threads) {
            expect(thread.id).to.be.lessThan(MAX_SIGNED_INT32 + 1, 'ThreadId is not an integer');
        }
    });
    test('Test stack frames', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stackFrame.py', false)),
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
        const fileSystem = new FileSystem(new PlatformService());
        expect(stackframes.body.stackFrames[0].line).to.be.equal(5);
        expect(fileSystem.arePathsSame(stackframes.body.stackFrames[0].source!.path!, pythonFile)).to.be.equal(true, 'paths do not match');
        expect(stackframes.body.stackFrames[0].name).to.be.equal('foo');

        expect(stackframes.body.stackFrames[1].line).to.be.equal(8);
        expect(fileSystem.arePathsSame(stackframes.body.stackFrames[1].source!.path!, pythonFile)).to.be.equal(true, 'paths do not match');
        expect(stackframes.body.stackFrames[1].name).to.be.equal('bar');

        expect(stackframes.body.stackFrames[2].line).to.be.equal(10);
        expect(fileSystem.arePathsSame(stackframes.body.stackFrames[2].source!.path!, pythonFile)).to.be.equal(true, 'paths do not match');
    });
    test('Test Evaluation of Expressions', async () => {
        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2WithoutSleep.py'), column: 1, line: 5 };
        const breakpointArgs = {
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        };
        await Promise.all([
            debugClient.launch(buildLaunchArgs('sample2WithoutSleep.py', false)),
            debugClient.waitForEvent('initialized')
                .then(() => debugClient.setBreakpointsRequest(breakpointArgs))
                .then(() => debugClient.configurationDoneRequest())
                .then(() => debugClient.threadsRequest()),
            debugClient.waitForEvent('thread'),
            debugClient.assertStoppedLocation('breakpoint', breakpointLocation)
        ]);

        //Do not remove this, this is required to ensure PTVSD is ready to accept other requests.
        await debugClient.threadsRequest();
        const evaluateResponse = await debugClient.evaluateRequest({ context: 'repl', expression: 'a+b+2', frameId: 1 });
        expect(evaluateResponse.body.type).to.equal('int');
        expect(evaluateResponse.body.result).to.equal('5');
        await continueDebugging(debugClient);
    });
    test('Test Passing custom args to python file', async () => {
        const options = buildLaunchArgs('printSysArgv.py', false);
        options.args = ['1', '2', '3'];
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(options),
            debugClient.assertOutput('stdout', options.args.join(',')),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test Logpoints', async () => {
        const breakpointLocation = { path: path.join(debugFilesPath, 'logMessage.py'), line: 4 };
        const breakpointArgs: DebugProtocol.SetBreakpointsArguments = {
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, logMessage: 'Sum of {a} and {b} is 3' }],
            source: { path: breakpointLocation.path }
        };
        await Promise.all([
            debugClient.launch(buildLaunchArgs('logMessage.py', false)),
            debugClient.waitForEvent('initialized')
                .then(() => debugClient.setBreakpointsRequest(breakpointArgs))
                .then(() => debugClient.configurationDoneRequest())
                .then(() => debugClient.threadsRequest()),
            debugClient.waitForEvent('thread')
                .then(() => debugClient.threadsRequest()),
            debugClient.assertOutput('stdout', 'Sum of 1 and 2 is 3'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test Hit Count Breakpoints', async () => {
        const breakpointLocation = { path: path.join(debugFilesPath, 'loopyTest.py'), column: 1, line: 2 };
        const breakpointArgs: DebugProtocol.SetBreakpointsArguments = {
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column, hitCondition: '5' }],
            source: { path: breakpointLocation.path }
        };
        await Promise.all([
            debugClient.launch(buildLaunchArgs('loopyTest.py', false)),
            debugClient.waitForEvent('initialized')
                .then(() => debugClient.setBreakpointsRequest(breakpointArgs))
                .then(() => debugClient.configurationDoneRequest())
                .then(() => debugClient.threadsRequest()),
            debugClient.waitForEvent('thread'),
            debugClient.assertStoppedLocation('breakpoint', breakpointLocation)
        ]);

        //Do not remove this, this is required to ensure PTVSD is ready to accept other requests.
        await debugClient.threadsRequest();
        const evaluateResponse = await debugClient.evaluateRequest({ context: 'repl', expression: 'i', frameId: 1 });
        expect(evaluateResponse.body.type).to.equal('int');
        expect(evaluateResponse.body.result).to.equal('4');
        await continueDebugging(debugClient);
    });
});
