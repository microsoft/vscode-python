// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:insecure-random no-any

import * as typemoq from 'typemoq';
import { DiagnosticSeverity } from 'vscode';
import { ApplicationDiagnostics } from '../../../client/application/diagnostics/applicationDiagnostics';
import { InvalidMacPythonInterpreterServiceId } from '../../../client/application/diagnostics/checks/macPythonInterpreter';
import { DiagnosticScope, IDiagnostic, IDiagnosticsService, ISourceMapSupportService } from '../../../client/application/diagnostics/types';
import { IApplicationDiagnostics } from '../../../client/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { ILogger, IOutputChannel } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('xApplication Diagnostics - ApplicationDiagnostics', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let envHealthCheck: typemoq.IMock<IDiagnosticsService>;
    let debuggerTypeCheck: typemoq.IMock<IDiagnosticsService>;
    let macInterpreterCheck: typemoq.IMock<IDiagnosticsService>;
    let lsNotSupportedCheck: typemoq.IMock<IDiagnosticsService>;
    let pythonInterpreterCheck: typemoq.IMock<IDiagnosticsService>;
    let outputChannel: typemoq.IMock<IOutputChannel>;
    let logger: typemoq.IMock<ILogger>;
    let appDiagnostics: IApplicationDiagnostics;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        envHealthCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        debuggerTypeCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        macInterpreterCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        lsNotSupportedCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        pythonInterpreterCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        outputChannel = typemoq.Mock.ofType<IOutputChannel>();
        logger = typemoq.Mock.ofType<ILogger>();

        serviceContainer.setup(d => d.getAll(typemoq.It.isValue(IDiagnosticsService)))
            .returns(() => [envHealthCheck.object, debuggerTypeCheck.object, macInterpreterCheck.object, lsNotSupportedCheck.object, pythonInterpreterCheck.object]);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(IOutputChannel), typemoq.It.isValue(STANDARD_OUTPUT_CHANNEL)))
            .returns(() => outputChannel.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(ILogger)))
            .returns(() => logger.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(IDiagnosticsService),
            typemoq.It.isValue(InvalidMacPythonInterpreterServiceId)))
            .returns(() => macInterperterCheck.object);

        appDiagnostics = new ApplicationDiagnostics(serviceContainer.object, outputChannel.object);
    });

    test('Register should register source maps', () => {
        const sourceMapService = typemoq.Mock.ofType<ISourceMapSupportService>();
        sourceMapService.setup(s => s.register()).verifiable(typemoq.Times.once());

        serviceContainer.setup(d => d.get(typemoq.It.isValue(ISourceMapSupportService), typemoq.It.isAny()))
            .returns(() => sourceMapService.object);

        appDiagnostics.register();

        sourceMapService.verifyAll();
    });

    test('Performing Pre Startup Health Check must check Path environment variable and Debugger Type along with Mac Interpreter', async () => {
        envHealthCheck.setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        debuggerTypeCheck.setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        macInterpreterCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        lsNotSupportedCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        pythonInterpreterCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));

        await appDiagnostics.performPreStartupHealthCheck(undefined);

        envHealthCheck.verifyAll();
        debuggerTypeCheck.verifyAll();
        macInterperterCheck.verifyAll();
    });

    test('Diagnostics Returned by Per Startup Health Checks must be logged', async () => {
        const diagnostics: IDiagnostic[] = [];
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Error${i}` as any,
                message: `Error${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Error,
                resource: undefined,
                runInBackground: i % 2 === 0 ? true : false
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Warning${i}` as any,
                message: `Warning${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Warning,
                resource: undefined,
                runInBackground: i % 2 === 0 ? true : false
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Info${i}` as any,
                message: `Info${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Information,
                resource: undefined,
                runInBackground: i % 2 === 0 ? true : false
            };
            diagnostics.push(diagnostic);
        }

        for (const diagnostic of diagnostics) {
            const message = `Diagnostic Code: ${diagnostic.code}, Message: ${diagnostic.message}`;
            switch (diagnostic.severity) {
                case DiagnosticSeverity.Error: {
                    logger.setup(l => l.logError(message))
                        .verifiable(typemoq.Times.once());
                    outputChannel.setup(o => o.appendLine(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                case DiagnosticSeverity.Warning: {
                    logger.setup(l => l.logWarning(message))
                        .verifiable(typemoq.Times.once());
                    outputChannel.setup(o => o.appendLine(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    logger.setup(l => l.logInformation(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
            }
        }

        envHealthCheck.setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve(diagnostics))
            .verifiable(typemoq.Times.exactly(2));
        debuggerTypeCheck.setup(e => e.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        macInterpreterCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        lsNotSupportedCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));
        pythonInterpreterCheck.setup(p => p.diagnose(typemoq.It.isAny()))
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.exactly(2));

        await appDiagnostics.performPreStartupHealthCheck(undefined);

        envHealthCheck.verifyAll();
        debuggerTypeCheck.verifyAll();
        outputChannel.verifyAll();
        logger.verifyAll();
    });
});
