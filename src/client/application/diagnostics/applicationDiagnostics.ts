// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { ILogger, IOutputChannel } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationDiagnostics } from '../types';
import { EnvironmentPathVariableDiagnosticsServiceId } from './checks/envPathVariable';
import { IDiagnostic, IDiagnosticsService } from './types';

@injectable()
export class ApplicationDiagnostics implements IApplicationDiagnostics {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    public async performPreStartupHealthCheck(): Promise<void> {
        const envHealthCheck = this.serviceContainer.get<IDiagnosticsService>(IDiagnosticsService, EnvironmentPathVariableDiagnosticsServiceId);
        const diagnostics = await envHealthCheck.diagnose();
        this.log(diagnostics);
        if (diagnostics.length > 0) {
            await envHealthCheck.handle(diagnostics);
        }
    }
    private log(diagnostics: IDiagnostic[]): void {
        const logger = this.serviceContainer.get<ILogger>(ILogger);
        const outputChannel = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        diagnostics.forEach(item => {
            const message = `Diagnostic Code: ${item.code}, Mesage: ${item.message}`;
            switch (item.severity) {
                case DiagnosticSeverity.Error: {
                    logger.logError(message);
                    outputChannel.appendLine(message);
                    break;
                }
                case DiagnosticSeverity.Warning: {
                    logger.logWarning(message);
                    outputChannel.appendLine(message);
                    break;
                }
                default: {
                    logger.logInformation(message);
                }
            }
        });
    }
}
