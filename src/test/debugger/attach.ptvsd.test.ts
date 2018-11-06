// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as getFreePort from 'get-port';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, Uri } from 'vscode';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IPlatformService } from '../../client/common/platform/types';
import { IS_WINDOWS } from '../../client/common/util';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/constants';
import { PythonV2DebugConfigurationProvider } from '../../client/debugger/extension/configProviders/pythonV2Provider';
import { AttachRequestArguments, DebugOptions } from '../../client/debugger/types';
import { IServiceContainer } from '../../client/ioc/types';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { continueDebugging, createDebugAdapter } from './utils';

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement no-unused-variable no-console
const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');

suite('Attach Debugger', () => {
    let debugClient: DebugClient;
    let proc: ChildProcess;
    const logFile = path.join(EXTENSION_ROOT_DIR, 'debug.log');
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        console.log(`Log file path ${logFile}`);
        this.timeout(60000);
        await logToConsole();
        fs.removeSync(logFile);
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, 'debug_coverage_attach_ptvsd');
        debugClient = await createDebugAdapter(coverageDirectory);
    });
    async function logToConsole() {
        console.log('Logging file details');
        if (await fs.pathExists(logFile)) {
            const contents = await fs.readFile(path.join(EXTENSION_ROOT_DIR, 'debug.log'), { encoding: 'utf8' });
            console.log(contents);
        } else {
            console.error('No log file');
        }
    }
    teardown(async () => {
        await logToConsole();
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
        await logToConsole();
    });
    async function testAttachingToRemoteProcess(localRoot: string, remoteRoot: string, isLocalHostWindows: boolean) {
        const localHostPathSeparator = isLocalHostWindows ? '\\' : '/';
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const env = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = PTVSD_PATH;
        const pythonArgs = ['-m', 'ptvsd', '--host', 'localhost', '--wait', '--port', `${port}`, '--file', fileToDebug.fileToCommandArgument()];
        console.log(pythonArgs);
        proc = spawn(PYTHON_PATH, pythonArgs, { env: env, cwd: path.dirname(fileToDebug) });

        proc.stderr.on('data', (data: Buffer) => console.error(`\nStdErr:${data.toString()}`));
        proc.stdout.on('data', (data: Buffer) => console.info(`\nStdOut:${data.toString()}`));
        proc.once('error', ex => {
            console.error('error in proc');
            console.error(ex);
        });

        await sleep(3000);
        await logToConsole();
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
            logToFile: true,
            debugOptions: [DebugOptions.RedirectOutput]
        };
        const platformService = TypeMoq.Mock.ofType<IPlatformService>();
        platformService.setup(p => p.isWindows).returns(() => isLocalHostWindows);
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(IPlatformService, TypeMoq.It.isAny())).returns(() => platformService.object);
        const configProvider = new PythonV2DebugConfigurationProvider(serviceContainer.object);
        console.log('Step1');
        await logToConsole();
        await configProvider.resolveDebugConfiguration({ index: 0, name: 'root', uri: Uri.file(localRoot) }, options);
        console.log('Step2');
        await logToConsole();
        const attachPromise = debugClient.attachRequest(options);

        await Promise.all([
            initializePromise,
            attachPromise,
            debugClient.waitForEvent('initialized')
        ]);
        console.log('Step3');
        await logToConsole();
        // const stdOutPromise = debugClient.assertOutput('stdout', 'this is stdout');
        // const stdErrPromise = debugClient.assertOutput('stderr', 'this is stderr');

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
        console.log('Step4');
        await logToConsole();
        await Promise.all([
            breakpointPromise, exceptionBreakpointPromise,
            debugClient.configurationDoneRequest(), debugClient.threadsRequest(),
            // stdOutPromise, stdErrPromise,
            breakpointStoppedPromise
        ]);
        console.log('Step5');
        await logToConsole();
        await continueDebugging(debugClient);
        await sleep(500);

        console.log('Step6');
        await logToConsole();
    }
    test('Confirm we are able to attach to a running program', async () => {
        await testAttachingToRemoteProcess(path.dirname(fileToDebug), path.dirname(fileToDebug), IS_WINDOWS);
    });
});
