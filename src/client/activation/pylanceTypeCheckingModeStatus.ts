// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { Commands, PYTHON_LANGUAGE } from '../common/constants';
import { Commands as LSCommands } from './commands';
import { IConfigurationService, IDisposableRegistry } from '../common/types';
import { DelayedTrigger, IDelayedTrigger } from '../common/utils/delayTrigger';
import { LanguageService } from '../common/utils/localize';

import { IExtensionSingleActivationService, ILanguageServerCache, LanguageServerType } from './types';

const TypeCheckingSettingName = 'python.analysis.typeCheckingMode';

/**
 * Only partial features are available when running in untrusted or a
 * virtual workspace, this creates a UI element to indicate that.
 */
@injectable()
export class PylanceTypeCheckingModeStatusItem implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private statusItem: vscode.LanguageStatusItem | undefined;

    private configChangeTrigger: IDelayedTrigger;

    constructor(
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ILanguageServerCache) private readonly languageServerCache: ILanguageServerCache,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
    ) {
        this.commandManager.registerCommand(Commands.Set_TypeChecking, this.handlerUpdateTypeCheckingMode.bind(this));

        const configChangeTrigger = new DelayedTrigger(this.updateStatusItem.bind(this), 500, 'Configuration Change');
        this.configChangeTrigger = configChangeTrigger;
        this.disposables.push(configChangeTrigger);
    }

    public async activate(): Promise<void> {
        const languageServer = await this.languageServerCache.get(undefined);
        const experimentalSettings = languageServer.capabilities?.experimental;

        if (experimentalSettings?.recommendSettings) {
            const typeCheckingMode = this.workspace.getConfiguration('python.analysis').get<string>('typeCheckingMode');
            if (typeCheckingMode) {
                this.statusItem = createStatusItem(typeCheckingMode);
                if (this.statusItem) {
                    this.disposables.push(this.statusItem);
                }
            }

            this.registerHandlers();
        }

        this.configChangeTrigger.trigger(vscode.window.activeTextEditor?.document);
    }

    private registerHandlers() {
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(TypeCheckingSettingName)) {
                    this.configChangeTrigger.trigger(vscode.window.activeTextEditor?.document);
                }
            }),
        );
        this.disposables.push(
            this.documentManager.onDidChangeActiveTextEditor((e) => {
                if (e?.document.languageId === PYTHON_LANGUAGE) {
                    this.configChangeTrigger.trigger(e.document);
                }
            }),
        );
    }

    public dispose(): void {
        this.statusItem = undefined;
        this.disposables.forEach((d) => d.dispose());
    }

    public async updateStatusItem(document?: vscode.TextDocument): Promise<void> {
        const isPylance = this.configService.getSettings().languageServer === LanguageServerType.Node;
        if (!isPylance) {
            return;
        }

        const languageServer = await this.languageServerCache.get(undefined);

        languageServer.connection
            ?.sendRequest<string[] | undefined>(LSCommands.RecommendSettingLS, {
                textDocument: { uri: document?.uri.toString() },
                settings: [TypeCheckingSettingName],
            })
            .then((recommendedMode) => {
                if (!this.statusItem) {
                    return;
                }

                const typeMode =
                    this.workspace.getConfiguration('python.analysis').get<string>('typeCheckingMode') ?? '';

                const recommendedTypeMode = recommendedMode ? (recommendedMode[0] as string) : '';

                updateTypeCheckingStatusDetails(this.statusItem, typeMode, recommendedTypeMode);
            });
    }

    public async handlerUpdateTypeCheckingMode(typeCheckingMode: string): Promise<void | undefined> {
        await this.configService.updateSetting(
            'analysis.typeCheckingMode',
            typeCheckingMode,
            undefined,
            ConfigurationTarget.Workspace,
        );
    }
}

function createStatusItem(typeCheckingMode: string, recommendedMode?: string) {
    if (!('createLanguageStatusItem' in vscode.languages)) {
        return undefined;
    }

    const statusItem = vscode.languages.createLanguageStatusItem(TypeCheckingSettingName, {
        language: 'python',
    });

    updateTypeCheckingStatusDetails(statusItem, typeCheckingMode, recommendedMode ?? '');
    return statusItem;
}

function updateTypeCheckingStatusDetails(
    statusItem: vscode.LanguageStatusItem,
    typeCheckingMode: string,
    recommendedMode: string,
) {
    statusItem.name = LanguageService.statusItem.name;
    statusItem.text = `${LanguageService.pylanceTypeCheckingModeOffStatusItem.text}: ${typeCheckingMode}`;

    if (typeCheckingMode === 'off' && recommendedMode === 'basic') {
        statusItem.severity = vscode.LanguageStatusSeverity.Warning;
        statusItem.command = {
            title: LanguageService.pylanceTypeCheckingModeOffStatusItem.titleOn,
            command: Commands.Set_TypeChecking,
            arguments: ['basic'],
        };
    } else if (typeCheckingMode !== 'off') {
        statusItem.severity = vscode.LanguageStatusSeverity.Information;
        statusItem.command = {
            title: LanguageService.pylanceTypeCheckingModeOffStatusItem.titleOff,
            command: Commands.Set_TypeChecking,
            arguments: ['off'],
        };
    } else {
        statusItem.severity = vscode.LanguageStatusSeverity.Information;
    }
}
