// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { IOutputChannel, Resource } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { traceError, traceInfo, traceWarn } from '../../logging';
import { IApplicationDiagnostics } from '../types';
import { IDiagnostic, IDiagnosticsService, ISourceMapSupportService } from './types';

@injectable()
export class ApplicationDiagnostics implements IApplicationDiagnostics {
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel,
    ) {}
    public register() {
        this.serviceContainer.get<ISourceMapSupportService>(ISourceMapSupportService).register();
    }
    public async performPreStartupHealthCheck(resource: Resource): Promise<void> {
        // When testing, do not perform health checks, as modal dialogs can be displayed.
        if (isTestExecution()) {
            return;
        }
        const services = this.serviceContainer.getAll<IDiagnosticsService>(IDiagnosticsService);
        // Perform these validation checks in the foreground.
        await this.runDiagnostics(
            services.filter((item) => !item.runInBackground),
            resource,
        );
        // Perform these validation checks in the background.
        this.runDiagnostics(
            services.filter((item) => item.runInBackground),
            resource,
        ).ignoreErrors();
    }
    private async runDiagnostics(diagnosticServices: IDiagnosticsService[], resource: Resource): Promise<void> {
        await Promise.all(
            diagnosticServices.map(async (diagnosticService) => {
                const diagnostics = await diagnosticService.diagnose(resource);
                if (diagnostics.length > 0) {
                    this.log(diagnostics);
                    await diagnosticService.handle(diagnostics);
                }
            }),
        );
    }
    private log(diagnostics: IDiagnostic[]): void {
        diagnostics.forEach((item) => {
            const message = `Diagnostic Code: ${item.code}, Message: ${item.message}`;
            switch (item.severity) {
                case DiagnosticSeverity.Error: {
                    traceError(message);
                    this.outputChannel.appendLine(message);
                    break;
                }
                case DiagnosticSeverity.Warning: {
                    traceWarn(message);
                    this.outputChannel.appendLine(message);
                    break;
                }
                default: {
                    traceInfo(message);
                }
            }
        });
    }
}
