// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, named } from 'inversify';
import { DiagnosticSeverity, env, UIKind } from 'vscode';
import * as querystring from 'querystring';
import { IBrowserService, IDisposableRegistry, IExtensionContext, Resource } from '../../../common/types';
import { ExtensionSurveyBanner } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';
import { IApplicationEnvironment } from '../../../common/application/types';
import { IPlatformService } from '../../../common/platform/types';

export const MPLS_SURVEY_MEMENTO = 'mplsSurveyPromptMemento';

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
    private disabledInCurrentSession = false;

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IApplicationEnvironment) private appEnvironment: IApplicationEnvironment,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IBrowserService) private browserService: IBrowserService,
    ) {
        super([DiagnosticCodes.MPLSSurveyDiagnostic], serviceContainer, disposableRegistry, true);
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (!this.shouldShowPrompt) {
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

        await this.messageService.handle(diagnostic, {
            commandPrompts: [
                {
                    prompt: ExtensionSurveyBanner.bannerLabelYes(),
                    command: {
                        diagnostic,
                        invoke: async () => this.launchSurvey(),
                    },
                },
                {
                    prompt: ExtensionSurveyBanner.maybeLater(),
                    command: {
                        diagnostic,
                        invoke: async () => {
                            this.disabledInCurrentSession = true;
                        },
                    },
                },
                {
                    prompt: ExtensionSurveyBanner.bannerLabelNo(),
                    command: {
                        diagnostic,
                        invoke: async () => this.updateMemento(),
                    },
                },
            ],
            onClose: () => this.updateMemento(),
        });
    }

    private async updateMemento() {
        await this.context.globalState.update(MPLS_SURVEY_MEMENTO, true);
    }

    private get shouldShowPrompt(): boolean {
        return (
            env.uiKind !== UIKind?.Web &&
            !this.disabledInCurrentSession &&
            !this.context.globalState.get(MPLS_SURVEY_MEMENTO)
        );
    }

    private launchSurvey() {
        const query = querystring.stringify({
            o: encodeURIComponent(this.platformService.osType), // platform
            v: encodeURIComponent(this.appEnvironment.vscodeVersion),
            e: encodeURIComponent(this.appEnvironment.packageJson.version), // extension version
            m: encodeURIComponent(this.appEnvironment.sessionId),
        });
        const url = `https://www.surveymonkey.com/r/HD7MM9X?${query}`;
        this.browserService.launch(url);
    }
}
