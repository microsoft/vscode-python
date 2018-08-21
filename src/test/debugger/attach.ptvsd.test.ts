// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement

import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, Uri } from 'vscode';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import '../../client/common/extensions';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { IPlatformService } from '../../client/common/platform/types';
import { PythonV2DebugConfigurationProvider } from '../../client/debugger';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/Common/constants';
import { AttachRequestArguments, DebugOptions } from '../../client/debugger/Common/Contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { PYTHON_PATH, sleep } from '../common';
import { initialize, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { continueDebugging, createDebugAdapter } from './utils';

const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');

suite('Attach Debugger', () => {
    let debugClient: DebugClient;
    let proc: ChildProcess;
    suiteSetup(initialize);

    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        this.timeout(30000);
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, 'debug_coverage_attach_ptvsd');
        debugClient = await createDebugAdapter(coverageDirectory);
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            await debugClient.stop().catch(() => { });
        } catch (ex) { }
        if (proc) {
            try {
                proc.kill();
            } catch { }
        }
    });
    async function testAttachingToRemoteProcess(localRoot: string, remoteRoot: string, isLocalHostWindows: boolean) {
        const localHostPathSeparator = isLocalHostWindows ? '\\' : '/';
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const env = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = PTVSD_PATH;
        const pythonArgs = ['-m', 'ptvsd', '--server', '--port', `${port}`, '--file', fileToDebug.fileToCommandArgument()];
        proc = spawn(PYTHON_PATH, pythonArgs, { env: env, cwd: path.dirname(fileToDebug) });
        await sleep(3000);

        // Send initialize, attach
        const initializePromise = debugClient.initializeRequest({
            adapterID: DebuggerTypeName,
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path',
            supportsVariableType: true,
            supportsVariablePaging: true
        });
        const options: AttachRequestArguments & DebugConfiguration = {
            name: 'attach',
            request: 'attach',
            localRoot,
            remoteRoot,
            type: DebuggerTypeName,
            port: port,
            host: 'localhost',
            logToFile: false,
            debugOptions: [DebugOptions.RedirectOutput]
        };
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        platformService.setup(p => p.isWindows).returns(() => isLocalHostWindows);
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(IPlatformService, TypeMoq.It.isAny())).returns(() => platformService.object);
        const configProvider = new PythonV2DebugConfigurationProvider(serviceContainer.object);

        await configProvider.resolveDebugConfiguration({ index: 0, name: 'root', uri: Uri.file(localRoot) }, options);
        const attachPromise = debugClient.attachRequest(options);

        await Promise.all([
            initializePromise,
            attachPromise,
            debugClient.waitForEvent('initialized')
        ]);

        const stdOutPromise = debugClient.assertOutput('stdout', 'this is stdout');
        const stdErrPromise = debugClient.assertOutput('stderr', 'this is stderr');

        // Don't use path utils, as we're building the paths manually (mimic windows paths on unix test servers and vice versa).
        const localFileName = `${localRoot}${localHostPathSeparator}${path.basename(fileToDebug)}`;
        const breakpointLocation = { path: localFileName, column: 1, line: 12 };
        const breakpointPromise = debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });
        const exceptionBreakpointPromise = debugClient.setExceptionBreakpointsRequest({ filters: [] });
        const breakpointStoppedPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await Promise.all([
            breakpointPromise, exceptionBreakpointPromise,
            debugClient.configurationDoneRequest(), debugClient.threadsRequest(),
            stdOutPromise, stdErrPromise,
            breakpointStoppedPromise
        ]);

        await Promise.all([
            continueDebugging(debugClient),
            debugClient.assertOutput('stdout', 'this is print'),
            debugClient.waitForEvent('exited'),
            debugClient.waitForEvent('terminated')
        ]);
    }
    test('Confirm we are able to attach to a running program', async () => {
        await testAttachingToRemoteProcess(path.dirname(fileToDebug), path.dirname(fileToDebug), IS_WINDOWS);
    });
});
