// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:insecure-random

import * as typemoq from 'typemoq';
import { DiagnosticSeverity } from 'vscode';
import { ApplicationDiagnostics } from '../../../client/application/diagnostics/applicationDiagnostics';
import { EnvironmentPathVariableDiagnosticsServiceId } from '../../../client/application/diagnostics/checks/envPathVariable';
import { DiagnosticScope, IDiagnostic, IDiagnosticsService } from '../../../client/application/diagnostics/types';
import { IApplicationDiagnostics } from '../../../client/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { ILogger, IOutputChannel } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Application Diagnostics - ApplicationDiagnostics', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let envHealthCheck: typemoq.IMock<IDiagnosticsService>;
    let outputChannel: typemoq.IMock<IOutputChannel>;
    let logger: typemoq.IMock<ILogger>;
    let appDiagnostics: IApplicationDiagnostics;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        envHealthCheck = typemoq.Mock.ofType<IDiagnosticsService>();
        outputChannel = typemoq.Mock.ofType<IOutputChannel>();
        logger = typemoq.Mock.ofType<ILogger>();

        serviceContainer.setup(d => d.get(typemoq.It.isValue(IDiagnosticsService), typemoq.It.isValue(EnvironmentPathVariableDiagnosticsServiceId)))
            .returns(() => envHealthCheck.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(IOutputChannel), typemoq.It.isValue(STANDARD_OUTPUT_CHANNEL)))
            .returns(() => outputChannel.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(ILogger)))
            .returns(() => logger.object);

        appDiagnostics = new ApplicationDiagnostics(serviceContainer.object);
    });

    test('Performing Pre Startup Health Check must check Path environment variable', async () => {
        envHealthCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());

        await appDiagnostics.performPreStartupHealthCheck();

        envHealthCheck.verifyAll();
    });

    test('Diagnostics Returned by Per Startup Health Checks must be logged', async () => {
        const diagnostics: IDiagnostic[] = [];
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Error${i}`,
                message: `Error${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Error
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Warning${i}`,
                message: `Warning${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Warning
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic: IDiagnostic = {
                code: `Info${i}`,
                message: `Info${i}`,
                scope: i % 2 === 0 ? DiagnosticScope.Global : DiagnosticScope.WorkspaceFolder,
                severity: DiagnosticSeverity.Information
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

        envHealthCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve(diagnostics))
            .verifiable(typemoq.Times.once());

        await appDiagnostics.performPreStartupHealthCheck();

        envHealthCheck.verifyAll();
        outputChannel.verifyAll();
        logger.verifyAll();
    });
});
