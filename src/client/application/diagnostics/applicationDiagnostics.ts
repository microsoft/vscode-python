// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { ILogger, IOutputChannel, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationDiagnostics } from '../types';
import { InvalidMacPythonInterpreterServiceId } from './checks/macPythonInterpreter';
import { IDiagnostic, IDiagnosticsService, ISourceMapSupportService } from './types';

@injectable()
export class ApplicationDiagnostics implements IApplicationDiagnostics {
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel
    ) {}
    public register() {
        this.serviceContainer.get<ISourceMapSupportService>(ISourceMapSupportService).register();
    }
    public async performPreStartupHealthCheck(resource: Resource): Promise<void> {
        const diagnosticsServices = this.serviceContainer.getAll<IDiagnosticsService>(IDiagnosticsService);
        await Promise.all(
            diagnosticsServices.map(async diagnosticsService => {
                const diagnostics = await diagnosticsService.diagnose(resource);
                this.log(diagnostics);
                if (diagnostics.length > 0) {
                    await diagnosticsService.handle(diagnostics);
                }
            })
        );

        // Validate the Mac interperter in the background.
        const macInterpreterService = this.serviceContainer.get<IDiagnosticsService>(
            IDiagnosticsService,
            InvalidMacPythonInterpreterServiceId
        );
        macInterpreterService
            .diagnose(undefined)
            .then(diagnostics => macInterpreterService.handle(diagnostics))
            .ignoreErrors();
    }
    private log(diagnostics: IDiagnostic[]): void {
        const logger = this.serviceContainer.get<ILogger>(ILogger);
        diagnostics.forEach(item => {
            const message = `Diagnostic Code: ${item.code}, Message: ${item.message}`;
            switch (item.severity) {
                case DiagnosticSeverity.Error: {
                    logger.logError(message);
                    this.outputChannel.appendLine(message);
                    break;
                }
                case DiagnosticSeverity.Warning: {
                    logger.logWarning(message);
                    this.outputChannel.appendLine(message);
                    break;
                }
                default: {
                    logger.logInformation(message);
                }
            }
        });
    }
}
