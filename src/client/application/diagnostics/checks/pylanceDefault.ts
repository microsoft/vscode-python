// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { EXTENSION_VERSION_MEMENTO } from '../../../common/startPage/startPage';
import { IDisposableRegistry, IExtensionContext, Resource } from '../../../common/types';
import { Diagnostics, Common } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

export const PYLANCE_PROMPT_MEMENTO = 'pylanceDefaultPromptMemento';

export class PylanceDefaultDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.PylanceDefaultDiagnostic,
            message,
            DiagnosticSeverity.Information,
            DiagnosticScope.Global,
            resource,
        );
    }
}

export const PylanceDefaultDiagnosticServiceId = 'PylanceDefaultDiagnosticServiceId';

export class PylanceDefaultDiagnosticService extends BaseDiagnosticsService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super([DiagnosticCodes.PylanceDefaultDiagnostic], serviceContainer, disposableRegistry, false);
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (!this.shouldShowPrompt()) {
            return [];
        }

        return [new PylanceDefaultDiagnostic(Diagnostics.pylanceDefaultMessage(), resource)];
    }

    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }

        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }

        const options = [
            {
                prompt: Common.ok(),
                command: {
                    diagnostic,
                    invoke: async (): Promise<void> => {
                        await this.context.globalState.update(PYLANCE_PROMPT_MEMENTO, true);
                    },
                },
            },
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }

    private shouldShowPrompt(): boolean {
        const savedVersion: string | undefined = this.context.globalState.get(EXTENSION_VERSION_MEMENTO);
        const promptShown: boolean | undefined = this.context.globalState.get(PYLANCE_PROMPT_MEMENTO);

        // savedVersion being undefined means that this is the first time the user activates the extension.
        // promptShown being undefined means that this is the first time we check if we should show the prompt.
        return savedVersion !== undefined && promptShown === undefined;
    }
}
