// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any no-http-string

import { expect } from 'chai';
import * as getFreePort from 'get-port';
import * as path from 'path';
import * as request from 'request';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { DebugClientEx } from './debugClient';

const testAdapterFilePath = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'mainV2.js');
const workspaceDirectory = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'flskApp');
let testCounter = 0;
const debuggerType = 'pythonExperimental';
suite(`Flask Debugging - Misc tests: ${debuggerType}`, () => {
    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = createDebugAdapter();
        debugClient.defaultTimeout = 2 * DEBUGGER_TIMEOUT;
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
    function buildLauncArgs(port: number): LaunchRequestArguments {
        const env = {};
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = `.${path.delimiter}${path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd')}`;
        // tslint:disable-next-line:no-string-literal
        env['FLASK_APP'] = path.join(workspaceDirectory, 'run.py');

        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            module: 'flask',
            program: '',
            cwd: workspaceDirectory,
            debugOptions: [DebugOptions.RedirectOutput, DebugOptions.Jinja],
            pythonPath: 'python',
            args: [
                'run',
                '--no-debugger',
                '--no-reload',
                '--port',
                `${port}`
            ],
            env,
            envFile: '',
            logToFile: true,
            type: debuggerType
        };

        return options;
    }

    test('Test Flask Route and Template debugging', async function () {
        this.timeout(5 * DEBUGGER_TIMEOUT);
        const port = await getFreePort({ host: 'localhost' });

        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs(port)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('process'),
            debugClient.waitForEvent('thread')
        ]);

        const httpResult = await new Promise<string>((resolve, reject) => {
            request.get(`http://localhost:${port}`, (error: any, response: request.Response, body: any) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Status code = ${response.statusCode}`));
                } else {
                    resolve(body.toString());
                }
            });
        });

        expect(httpResult.trim()).to.be.equal('Hello World!');

        const breakpointLocation = { path: path.join(workspaceDirectory, 'run.py'), column: 1, line: 7 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        // Make the request, we want the breakpoint to be hit.
        const breakpointPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        request.get(`http://localhost:${port}`);
        await breakpointPromise;

        async function continueDebugging() {
            const threads = await debugClient.threadsRequest();
            expect(threads).to.be.not.equal(undefined, 'no threads response');
            expect(threads.body.threads).to.be.lengthOf(1);

            await debugClient.continueRequest({ threadId: threads.body.threads[0].id });
        }

        await continueDebugging();

        // Template debugging.
        const templateBreakpointLocation = { path: path.join(workspaceDirectory, 'templates', 'hello.html'), column: 1, line: 5 };
        await debugClient.setBreakpointsRequest({
            lines: [templateBreakpointLocation.line],
            breakpoints: [{ line: templateBreakpointLocation.line, column: templateBreakpointLocation.column }],
            source: { path: templateBreakpointLocation.path }
        });

        const templateBreakpointPromise = debugClient.assertStoppedLocation('breakpoint', templateBreakpointLocation);
        const httpTemplateResult = new Promise<string>((resolve, reject) => {
            request.get(`http://localhost:${port}/hello/Don`, { timeout: 100000 }, (error: any, response: request.Response, body: any) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Status code = ${response.statusCode}`));
                } else {
                    resolve(body.toString());
                }
            });
        });

        const frames = await templateBreakpointPromise;

        // Wait for breakpoint to hit
        const frameId = frames.body.stackFrames[0].id;
        const scopes = await debugClient.scopesRequest({ frameId });

        expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
        const variablesReference = scopes.body.scopes[0].variablesReference;
        const variables = await debugClient.variablesRequest({ variablesReference });

        const vari = variables.body.variables.find(item => item.name === 'name')!;
        expect(vari).to.be.not.equal('undefined', 'variable \'name\' is undefined');
        expect(vari.type).to.be.equal('str');
        expect(vari.value).to.be.equal('\'Don\'');

        await continueDebugging();
        const htmlResult = await httpTemplateResult;
        expect(htmlResult).to.contain('Hello Don');
    });
});
