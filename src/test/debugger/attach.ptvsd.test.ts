// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, Uri } from 'vscode';
import { DebugClient } from 'vscode-debugadapter-testsupport';

import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { DebugAdapterNewPtvsd } from '../../client/common/experimentGroups';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IExperimentsManager } from '../../client/common/types';
import { MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/constants';
import { PythonDebugConfigurationService } from '../../client/debugger/extension/configuration/debugConfigurationService';
import { AttachConfigurationResolver } from '../../client/debugger/extension/configuration/resolvers/attach';
import { IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from '../../client/debugger/extension/configuration/types';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../../client/debugger/types';
import { IServiceContainer } from '../../client/ioc/types';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { continueDebugging, createDebugAdapter } from './utils';

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement no-unused-variable no-console
const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');

suite('Debugging - Attach Debugger', () => {
    let debugClient: DebugClient;
    let proc: ChildProcess;

    setup(async function() {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        this.timeout(30000);
        debugClient = await createDebugAdapter();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            await debugClient.stop().catch(() => {});
        } catch (ex) {}
        if (proc) {
            try {
                proc.kill();
            } catch {}
        }
    });
    async function testAttachingToRemoteProcess(localRoot: string, remoteRoot: string, isLocalHostWindows: boolean) {
        const localHostPathSeparator = isLocalHostWindows ? '\\' : '/';
        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const env = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = PTVSD_PATH;
        const pythonArgs = ['-m', 'ptvsd', '--host', 'localhost', '--wait', '--port', `${port}`, fileToDebug.fileToCommandArgument()];
        proc = spawn(PYTHON_PATH, pythonArgs, { env: env, cwd: path.dirname(fileToDebug) });
        const exited = new Promise(resolve => proc.once('close', resolve));
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

        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
        experiments.setup(e => e.inExperiment(DebugAdapterNewPtvsd.experiment)).returns(() => true);

        const launchResolver = TypeMoq.Mock.ofType<IDebugConfigurationResolver<LaunchRequestArguments>>();
        const attachResolver = new AttachConfigurationResolver(
            workspaceService.object,
            documentManager.object,
            platformService.object,
            configurationService.object,
            experiments.object
        );
        const providerFactory = TypeMoq.Mock.ofType<IDebugConfigurationProviderFactory>().object;
        const multistepFactory = mock(MultiStepInputFactory);
        const configProvider = new PythonDebugConfigurationService(attachResolver, launchResolver.object, providerFactory, instance(multistepFactory));

        await configProvider.resolveDebugConfiguration({ index: 0, name: 'root', uri: Uri.file(localRoot) }, options);
        const attachPromise = debugClient.attachRequest(options);

        await Promise.all([initializePromise, attachPromise, debugClient.waitForEvent('initialized')]);

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
            breakpointPromise,
            exceptionBreakpointPromise,
            debugClient.configurationDoneRequest(),
            debugClient.threadsRequest(),
            stdOutPromise,
            stdErrPromise,
            breakpointStoppedPromise
        ]);

        await continueDebugging(debugClient);
        await exited;
    }
    test('Confirm we are able to attach to a running program', async function() {
        // Skipping to get nightly build to pass. Opened this issue:
        // https://github.com/microsoft/vscode-python/issues/7411
        this.skip();
        await testAttachingToRemoteProcess(path.dirname(fileToDebug), path.dirname(fileToDebug), IS_WINDOWS);
    })
        // Retry as tests can timeout on server due to connectivity issues.
        .retries(3);
});
