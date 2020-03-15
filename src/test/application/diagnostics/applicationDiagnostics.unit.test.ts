// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:insecure-random no-any

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { DiagnosticSeverity } from 'vscode';
import { ApplicationDiagnostics } from '../../../client/application/diagnostics/applicationDiagnostics';
import { EnvironmentPathVariableDiagnosticsService } from '../../../client/application/diagnostics/checks/envPathVariable';
import { InvalidPythonInterpreterService } from '../../../client/application/diagnostics/checks/pythonInterpreter';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticsService,
    ISourceMapSupportService
} from '../../../client/application/diagnostics/types';
import { IApplicationDiagnostics } from '../../../client/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { IOutputChannel } from '../../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../../client/common/utils/async';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../common';

// tslint:disable-next-line:max-func-body-length
suite('Application Diagnostics - ApplicationDiagnostics', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let envHealthCheck: typemoq.IMock<IDiagnosticsService>;
    let lsNotSupportedCheck: typemoq.IMock<IDiagnosticsService>;
    let pythonInterpreterCheck: typemoq.IMock<IDiagnosticsService>;
    let outputChannel: typemoq.IMock<IOutputChannel>;
    let appDiagnostics: IApplicationDiagnostics;
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;

    setup(() => {
        delete process.env.VSC_PYTHON_UNIT_TEST;
        delete process.env.VSC_PYTHON_CI_TEST;
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        envHealthCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        envHealthCheck.setup(service => service.runInBackground).returns(() => true);
        lsNotSupportedCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        lsNotSupportedCheck.setup(service => service.runInBackground).returns(() => false);
        pythonInterpreterCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        pythonInterpreterCheck.setup(service => service.runInBackground).returns(() => false);
        outputChannel = typemoq.Mock.ofType<IOutputChannel>();

        serviceContainer
            .setup(d => d.getAll(typemoq.It.isValue(IDiagnosticsService)))
            .returns(() => [envHealthCheck.object, lsNotSupportedCheck.object, pythonInterpreterCheck.object]);
        serviceContainer
            .setup(d => d.get(typemoq.It.isValue(IOutputChannel), typemoq.It.isValue(STANDARD_OUTPUT_CHANNEL)))
            .returns(() => outputChannel.object);

        appDiagnostics = new ApplicationDiagnostics(serviceContainer.object, outputChannel.object);
    });

    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
    });

    test('Register should register source maps', () => {
        const sourceMapService = typemoq.Mock.ofType<ISourceMapSupportService>();
        sourceMapService.setup(s => s.register()).verifiable(typemoq.Times.once());

        serviceContainer
            .setup(d => d.get(typemoq.It.isValue(ISourceMapSupportService), typemoq.It.isAny()))
            .returns(() => sourceMapService.object);

        appDiagnostics.register();

        sourceMapService.verifyAll();
    });

    test('Performing Pre Startup Health Check must diagnose all validation checks', async () => {
        envHealthCheck
            .setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        lsNotSupportedCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        pythonInterpreterCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());

        await appDiagnostics.performPreStartupHealthCheck(undefined);

        envHealthCheck.verifyAll();
        lsNotSupportedCheck.verifyAll();
        pythonInterpreterCheck.verifyAll();
    });

    test('Performing Pre Startup Health Check must handles all validation checks only once either in background or foreground', async () => {
        const diagnostic: IDiagnostic = {
            code: 'Error' as any,
            message: 'Error',
            scope: undefined,
            severity: undefined,
            resource: undefined,
            invokeHandler: 'default'
        } as any;
        envHealthCheck
            .setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([diagnostic]))
            .verifiable(typemoq.Times.once());
        envHealthCheck
            .setup(p => p.handle(typemoq.It.isValue([diagnostic])))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        lsNotSupportedCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([diagnostic]))
            .verifiable(typemoq.Times.once());
        lsNotSupportedCheck
            .setup(p => p.handle(typemoq.It.isValue([diagnostic])))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        pythonInterpreterCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([diagnostic]))
            .verifiable(typemoq.Times.once());
        pythonInterpreterCheck
            .setup(p => p.handle(typemoq.It.isValue([diagnostic])))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await appDiagnostics.performPreStartupHealthCheck(undefined);
        await sleep(1);

        pythonInterpreterCheck.verifyAll();
        lsNotSupportedCheck.verifyAll();
        envHealthCheck.verifyAll();
    });

    test('Diagnostics Returned by Pre Startup Health Checks must be logged', async () => {
        const diagnostics: IDiagnostic[] = [];
        for (let i = 0; i <= Math.random() * 10; i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Error${i}` as any,
                message: `Error${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Error,
                resource: undefined,
                invokeHandler: 'default'
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= Math.random() * 10; i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Warning${i}` as any,
                message: `Warning${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Warning,
                resource: undefined,
                invokeHandler: 'default'
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= Math.random() * 10; i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Info${i}` as any,
                message: `Info${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Information,
                resource: undefined,
                invokeHandler: 'default'
            };
            diagnostics.push(diagnostic);
        }

        for (const diagnostic of diagnostics) {
            const message = `Diagnostic Code: ${diagnostic.code}, Message: ${diagnostic.message}`;
            switch (diagnostic.severity) {
                case DiagnosticSeverity.Error: {
                    outputChannel.setup(o => o.appendLine(message)).verifiable(typemoq.Times.once());
                    break;
                }
                case DiagnosticSeverity.Warning: {
                    outputChannel.setup(o => o.appendLine(message)).verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    break;
                }
            }
        }

        envHealthCheck
            .setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve(diagnostics))
            .verifiable(typemoq.Times.once());
        lsNotSupportedCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        pythonInterpreterCheck
            .setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());

        await appDiagnostics.performPreStartupHealthCheck(undefined);
        await sleep(1);

        envHealthCheck.verifyAll();
        lsNotSupportedCheck.verifyAll();
        pythonInterpreterCheck.verifyAll();
        outputChannel.verifyAll();
    });
    test('Ensure diagnostics run in foreground and background', async () => {
        const foreGroundService = mock(InvalidPythonInterpreterService);
        const backGroundService = mock(EnvironmentPathVariableDiagnosticsService);
        const svcContainer = mock(ServiceContainer);
        const foreGroundDeferred = createDeferred<IDiagnostic[]>();
        const backgroundGroundDeferred = createDeferred<IDiagnostic[]>();

        when(svcContainer.getAll<IDiagnosticsService>(IDiagnosticsService)).thenReturn([
            instance(foreGroundService),
            instance(backGroundService)
        ]);
        when(foreGroundService.runInBackground).thenReturn(false);
        when(backGroundService.runInBackground).thenReturn(true);

        when(foreGroundService.diagnose(anything())).thenReturn(foreGroundDeferred.promise);
        when(backGroundService.diagnose(anything())).thenReturn(backgroundGroundDeferred.promise);

        const service = new ApplicationDiagnostics(instance(svcContainer), outputChannel.object);

        const promise = service.performPreStartupHealthCheck(undefined);
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        verify(foreGroundService.runInBackground).atLeast(1);
        verify(backGroundService.runInBackground).atLeast(1);

        assert.equal(deferred.completed, false);
        foreGroundDeferred.resolve([]);
        await sleep(1);

        assert.equal(deferred.completed, true);

        backgroundGroundDeferred.resolve([]);
        await sleep(1);
        verify(foreGroundService.diagnose(anything())).once();
        verify(backGroundService.diagnose(anything())).once();
    });
});
