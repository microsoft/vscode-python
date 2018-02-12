// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-suspicious-comment max-func-body-length

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { IS_MULTI_ROOT_TEST } from '../initialize';

use(chaiAsPromised);

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');

// tslint:disable-next-line:max-func-body-length
suite('Standard Debugging - Misc tests', () => {
    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = new DebugClient('node', DEBUG_ADAPTER, 'python');
        await debugClient.start();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            // tslint:disable-next-line:no-empty
            await debugClient.stop().catch(() => { });
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
    });

    function buildLauncArgs(pythonFile: string, stopOnEntry: boolean = false): LaunchRequestArguments {
        return {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            debugOptions: ['RedirectOutput'],
            pythonPath: 'python',
            args: [],
            envFile: ''
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
    test('Should stop on entry', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('simplePrint.py', true)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('stopped')
        ]);
    });
    test('test stderr output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('stdErrOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            //TODO: ptvsd does not differentiate.
            debugClient.assertOutput('stdout', 'error output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test stdout output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('stdOutOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'normal output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Should run program to the end (with stopOnEntry=true and continue)', async () => {
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
    test('Should break at print statement (line 3)', async () => {
        const launchArgs = buildLauncArgs('sample2.py', false);
        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.hitBreakpoint(launchArgs, breakpointLocation);
    });
    test('Test conditional breakpoints', async () => {
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('forever.py', false)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'forever.py'), column: 0, line: 5 };
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
            debugClient.launch(buildLauncArgs('sample2.py', true)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.continueRequest({ threadId });

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
        expect(varfile.value).to.be.equal(`'${path.join(debugFilesPath, 'sample2.py')}'`);
        expect(vardoc).to.be.not.equal('undefined', 'variable \'__doc__\' is undefined');
    });
    test('Test editing variables', async () => {
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('sample2.py', true)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.continueRequest({ threadId });

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
            debugClient.launch(buildLauncArgs('sample2.py', true)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        const stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.continueRequest({ threadId });

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
            debugClient.launch(buildLauncArgs('sample2.py', true)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        // hit breakpoint.
        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        let stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.continueRequest({ threadId });
        await stackFramesPromise;

        const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 5 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', functionLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;

        const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 9 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', functionInvocationLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;

        const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 11 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', printLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;
    });
    test('Test stepin and stepout', async () => {
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('sample2.py', true)),
            debugClient.waitForEvent('initialized')
        ]);

        const breakpointLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 3 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        // hit breakpoint.
        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        let stackFramesPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.continueRequest({ threadId });
        await stackFramesPromise;

        const functionLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 5 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', functionLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;

        const functionInvocationLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 9 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', functionInvocationLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;

        const loopPrintLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 6 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', loopPrintLocation);
        await debugClient.stepInRequest({ threadId });
        await stackFramesPromise;

        stackFramesPromise = debugClient.assertStoppedLocation('step', functionInvocationLocation);
        await debugClient.stepOutRequest({ threadId });
        await stackFramesPromise;

        const printLocation = { path: path.join(debugFilesPath, 'sample2.py'), column: 0, line: 11 };
        stackFramesPromise = debugClient.assertStoppedLocation('step', printLocation);
        await debugClient.nextRequest({ threadId });
        await stackFramesPromise;
    });
    test('Test pausing', async () => {
        const threadIdPromise = debugClient.waitForEvent('thread');

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('forever.py', true)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('stopped')
        ]);

        const threadId = ((await threadIdPromise) as ThreadEvent).body.threadId;
        await debugClient.continueRequest({ threadId });

        await sleep(3);
        const pauseLocation = { path: path.join(debugFilesPath, 'forever.py'), line: 5 };
        const pausePromise = debugClient.assertStoppedLocation('user request', pauseLocation);
        await debugClient.pauseRequest({ threadId });
        await pausePromise;
    });
    test('Test pausing on exceptions', async () => {
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
        const breakpointLocation = { path: pythonFile, column: 0, line: 11 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        // hit breakpoint.
        await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

        const threads = await debugClient.threadsRequest();
        expect(threads.body.threads).of.lengthOf(2, 'incorrect number of threads');
    });
    test('Test stack frames', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('stackFrame.py', false)),
            debugClient.waitForEvent('initialized')
        ]);
        const pythonFile = path.join(debugFilesPath, 'stackFrame.py');
        const breakpointLocation = { path: pythonFile, column: 0, line: 5 };
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
