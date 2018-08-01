// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any no-http-string no-string-literal no-console

import { expect } from 'chai';
import * as getFreePort from 'get-port';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { StopWatch } from '../../client/common/stopWatch';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { continueDebugging, createDebugAdapter, ExpectedVariable, hitHttpBreakpoint, makeHttpRequest, validateVariablesInFrame } from './utils';
import { DebuggerTypeName } from '../../client/debugger/Common/constants';

let testCounter = 0;
const debuggerType = DebuggerTypeName;
suite(`Django and Flask Debugging: ${debuggerType}`, () => {
    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        this.timeout(5 * DEBUGGER_TIMEOUT);
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, `debug_coverage_django_flask${testCounter += 1}`);
        debugClient = await createDebugAdapter(coverageDirectory);
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
    function buildLaunchArgs(workspaceDirectory: string): LaunchRequestArguments {
        const env = {};
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd');

        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            cwd: workspaceDirectory,
            program: '',
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
    async function buildFlaskLaunchArgs(workspaceDirectory: string) {
        const port = await getFreePort({ host: 'localhost' });
        const options = buildLaunchArgs(workspaceDirectory);

        options.env!['FLASK_APP'] = 'run.py';
        options.module = 'flask';
        options.debugOptions = [DebugOptions.RedirectOutput, DebugOptions.Jinja];
        options.args = [
            'run',
            '--no-debugger',
            '--no-reload',
            '--without-threads',
            '--port',
            `${port}`
        ];

        return { options, port };
    }
    async function buildDjangoLaunchArgs(workspaceDirectory: string) {
        const port = await getFreePort({ host: 'localhost' });
        const options = buildLaunchArgs(workspaceDirectory);

        options.program = path.join(workspaceDirectory, 'manage.py');
        options.debugOptions = [DebugOptions.RedirectOutput, DebugOptions.Django];
        options.args = [
            'runserver',
            '--noreload',
            '--nothreading',
            `${port}`
        ];

        return { options, port };
    }

    async function waitForWebServerToStart(url: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let maxTries = 50;
            const timeout = 10_000;
            const start = new StopWatch();
            const fn = () => {
                makeHttpRequest(url)
                    .then(resolve)
                    .catch(ex => {
                        maxTries -= 1;
                        if (maxTries === 0 || start.elapsedTime >= timeout) {
                            reject(ex);
                        } else {
                            setTimeout(fn, 100);
                        }
                    });
            };
            fn();
        });
    }

    async function testTemplateDebugging(launchArgs: LaunchRequestArguments, port: number, viewFile: string, viewLine: number, templateFile: string, templateLine: number) {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(launchArgs),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('process'),
            debugClient.waitForEvent('thread')
        ]);

        const url = `http://localhost:${port}`;

        await waitForWebServerToStart(url);

        const httpResult = await makeHttpRequest(url);
        expect(httpResult).to.contain('Hello this_is_a_value_from_server');
        expect(httpResult).to.contain('Hello this_is_another_value_from_server');

        await hitHttpBreakpoint(debugClient, url, viewFile, viewLine);

        await continueDebugging(debugClient);
        await debugClient.setBreakpointsRequest({ breakpoints: [], lines: [], source: { path: viewFile } });

        // Template debugging.
        const [stackTrace, htmlResultPromise] = await hitHttpBreakpoint(debugClient, url, templateFile, templateLine);

        // Wait for breakpoint to hit
        const expectedVariables: ExpectedVariable[] = [
            { name: 'value_from_server', type: 'str', value: '\'this_is_a_value_from_server\'' },
            { name: 'another_value_from_server', type: 'str', value: '\'this_is_another_value_from_server\'' }
        ];
        await validateVariablesInFrame(debugClient, stackTrace, expectedVariables, 1);

        await debugClient.setBreakpointsRequest({ breakpoints: [], lines: [], source: { path: templateFile } });
        await continueDebugging(debugClient);

        const htmlResult = await htmlResultPromise;
        expect(htmlResult).to.contain('Hello this_is_a_value_from_server');
        expect(htmlResult).to.contain('Hello this_is_another_value_from_server');
    }

    test('Test Flask Route and Template debugging', async () => {
        const workspaceDirectory = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'flaskApp');
        const { options, port } = await buildFlaskLaunchArgs(workspaceDirectory);

        await testTemplateDebugging(options, port,
            path.join(workspaceDirectory, 'run.py'), 7,
            path.join(workspaceDirectory, 'templates', 'index.html'), 6);
    });

    test('Test Django Route and Template debugging', async () => {
        const workspaceDirectory = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'djangoApp');
        const { options, port } = await buildDjangoLaunchArgs(workspaceDirectory);

        await testTemplateDebugging(options, port,
            path.join(workspaceDirectory, 'home', 'views.py'), 10,
            path.join(workspaceDirectory, 'home', 'templates', 'index.html'), 6);
    });
});
