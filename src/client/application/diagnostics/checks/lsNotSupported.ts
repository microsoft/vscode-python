// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { ILanguageServerCompatibilityService } from '../../../activation/types';
import { IDisposableRegistry, Resource } from '../../../common/types';
import { Diagnostics } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

class LSNotSupportedDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.LSNotSupportedDiagnostic,
            message,
            DiagnosticSeverity.Warning,
            DiagnosticScope.Global,
            resource,
        );
    }
}

export const LSNotSupportedDiagnosticServiceId = 'LSNotSupportedDiagnosticServiceId';

export class LSNotSupportedDiagnosticService extends BaseDiagnosticsService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(ILanguageServerCompatibilityService)
        private readonly lsCompatibility: ILanguageServerCompatibilityService,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super([DiagnosticCodes.LSNotSupportedDiagnostic], serviceContainer, disposableRegistry, false);
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (await this.lsCompatibility.isSupported()) {
            return [];
        }
        return [new LSNotSupportedDiagnostic(Diagnostics.lsNotSupported(), resource)];
    }

    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }
        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: 'More Info',
                command: commandFactory.createCommand(diagnostic, {
                    type: 'launch',
                    options: 'https://aka.ms/pythonlsrequirements',
                }),
            },
            {
                prompt: 'Do not show again',
                command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global }),
            },
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
}
