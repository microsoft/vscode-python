/* eslint-disable max-classes-per-file */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, DiagnosticSeverity } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { IDisposableRegistry, Resource } from '../../../common/types';
import { SwitchToPrereleaseExtension } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

export class SwitchToPreReleaseExtensionDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.SwitchToPreReleaseExtensionDiagnostic,
            message,
            DiagnosticSeverity.Warning,
            DiagnosticScope.Global,
            resource,
        );
    }
}

export const SwitchToPreReleaseExtensionDiagnosticServiceId = 'SwitchToPreReleaseExtensionDiagnosticServiceId';

@injectable()
export class SwitchToPreReleaseExtensionDiagnosticService extends BaseDiagnosticsService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super(
            [DiagnosticCodes.SwitchToPreReleaseExtensionDiagnostic],
            serviceContainer,
            disposableRegistry,
            true,
            true,
        );
    }

    public diagnose(resource: Resource): Promise<IDiagnostic[]> {
        const config = this.workspaceService.getConfiguration('python', resource);
        const value = config.inspect<string>('insidersChannel');
        if (value) {
            const insiderType = value.globalValue ?? value.globalLanguageValue;
            if (insiderType) {
                return Promise.resolve([
                    new SwitchToPreReleaseExtensionDiagnostic(SwitchToPrereleaseExtension.bannerMessage(), resource),
                ]);
            }
        }
        return Promise.resolve([]);
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
            onClose: () => {
                sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: 'closed' });
            },
            commandPrompts: [
                {
                    prompt: SwitchToPrereleaseExtension.installPreRelease(),
                    command: {
                        diagnostic,
                        invoke: (): Promise<void> => this.installExtension(true, diagnostic.resource),
                    },
                },
                {
                    prompt: SwitchToPrereleaseExtension.installStable(),
                    command: {
                        diagnostic,
                        invoke: (): Promise<void> => this.installExtension(false, diagnostic.resource),
                    },
                },
            ],
        });
    }

    private async installExtension(preRelease: boolean, resource: Resource): Promise<void> {
        sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: preRelease ? 'preRelease' : 'stable' });
        const config = this.workspaceService.getConfiguration('python', resource);
        const setting = config.inspect<string>('insidersChannel');
        if (setting) {
            config.update('insidersChannel', undefined, ConfigurationTarget.Global);
        }
        await this.commandManager.executeCommand(`workbench.extensions.installExtension`, PVSC_EXTENSION_ID, {
            installPreReleaseVersion: preRelease,
        });
    }
}
