// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, named } from 'inversify';
import { DiagnosticSeverity, UIKind } from 'vscode';
import * as querystring from 'querystring';
import { IDisposableRegistry, Resource } from '../../../common/types';
import { ExtensionSurveyBanner } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';
import { IApplicationEnvironment } from '../../../common/application/types';
import { IPlatformService } from '../../../common/platform/types';
import { IDiagnosticsCommandFactory } from '../commands/types';

export class MPLSSurveyDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.MPLSSurveyDiagnostic,
            message,
            DiagnosticSeverity.Information,
            DiagnosticScope.Global,
            resource,
        );
    }
}

export const MPLSSurveyDiagnosticServiceId = 'MPLSSurveyDiagnosticServiceId';

export class MPLSSurveyDiagnosticService extends BaseDiagnosticsService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IApplicationEnvironment) private appEnvironment: IApplicationEnvironment,
        @inject(IPlatformService) private platformService: IPlatformService,
    ) {
        super([DiagnosticCodes.MPLSSurveyDiagnostic], serviceContainer, disposableRegistry, true);
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (this.appEnvironment.uiKind === UIKind?.Web) {
            return [];
        }

        return [new MPLSSurveyDiagnostic(ExtensionSurveyBanner.mplsMessage(), resource)];
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

        await this.messageService.handle(diagnostic, {
            commandPrompts: [
                {
                    prompt: ExtensionSurveyBanner.bannerLabelYes(),
                    command: {
                        diagnostic,
                        invoke: () => this.launchSurvey(diagnostic),
                    },
                },
                {
                    prompt: ExtensionSurveyBanner.maybeLater(),
                },
                {
                    prompt: ExtensionSurveyBanner.bannerLabelNo(),
                    command: commandFactory.createCommand(diagnostic, {
                        type: 'ignore',
                        options: DiagnosticScope.Global,
                    }),
                },
            ],
        });
    }

    private async launchSurvey(diagnostic: IDiagnostic) {
        const query = querystring.stringify({
            o: encodeURIComponent(this.platformService.osType), // platform
            v: encodeURIComponent(this.appEnvironment.vscodeVersion),
            e: encodeURIComponent(this.appEnvironment.packageJson.version), // extension version
            m: encodeURIComponent(this.appEnvironment.sessionId),
        });
        const url = `https://aka.ms/mpls-experience-survey?${query}`;

        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        await commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global }).invoke();
        await commandFactory.createCommand(diagnostic, { type: 'launch', options: url }).invoke();
    }
}
