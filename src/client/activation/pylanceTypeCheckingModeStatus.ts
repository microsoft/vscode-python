// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { Commands as LSCommands } from './commands';
import { IConfigurationService, IDisposableRegistry } from '../common/types';
import { DelayedTrigger, IDelayedTrigger } from '../common/utils/delayTrigger';
import { LanguageService } from '../common/utils/localize';

import { IExtensionSingleActivationService, LanguageServerType } from './types';

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
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
    ) {
        commandManager.registerCommand(Commands.Set_TypeChecking, this.handlerUpdateTypeCheckingMode.bind(this));

        const configChangeTrigger = new DelayedTrigger(this.updateStatusItem.bind(this), 500, 'Configuration Change');
        this.configChangeTrigger = configChangeTrigger;
        this.disposables.push(configChangeTrigger);
    }

    public async activate(): Promise<void> {
        const typeCheckingMode = this.workspace.getConfiguration('python.analysis').get<string>('typeCheckingMode');
        if (typeCheckingMode) {
            this.statusItem = createStatusItem(typeCheckingMode);
            if (this.statusItem) {
                this.disposables.push(this.statusItem);
            }
        }

        this.registerHandlers();
    }

    private registerHandlers() {
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(TypeCheckingSettingName)) {
                    this.configChangeTrigger.trigger(e);
                }
            }),
        );
        this.disposables.push(
            this.documentManager.onDidOpenTextDocument((e) => {
                this.updateStatusItem(e.uri.toString());
            }),
        );
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    public async updateStatusItem(uriString?: string): Promise<void> {
        const languageServerType = this.configService.getSettings().languageServer;
        if (languageServerType !== LanguageServerType.Node) {
            return;
        }

        await this.commandManager
            .executeCommand(LSCommands.RecommendSettingPylanceLS, uriString, TypeCheckingSettingName)
            .then((recommendedMode) => {
                if (!this.statusItem) {
                    return;
                }

                const typeMode = this.workspace.getConfiguration('python.analysis').get<string>('typeCheckingMode');

                updateTypeCheckingStatusDetails(this.statusItem, typeMode ?? '', recommendedMode as string);
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

    updateTypeCheckingStatusDetails(statusItem, typeCheckingMode, recommendedMode);
    return statusItem;
}

function updateTypeCheckingStatusDetails(
    statusItem: vscode.LanguageStatusItem,
    typeCheckingMode: string,
    recommendedMode: string | undefined,
) {
    if (typeCheckingMode === 'off' && recommendedMode === 'basic') {
        statusItem.severity = vscode.LanguageStatusSeverity.Warning;
        statusItem.detail = LanguageService.pylanceTypeCheckingModeOffStatusItem.detail;
        statusItem.command = {
            title: 'Switch to basic',
            command: Commands.Set_TypeChecking,
            arguments: [recommendedMode],
        };
    } else if (typeCheckingMode !== 'off') {
        statusItem.severity = vscode.LanguageStatusSeverity.Information;
        statusItem.detail = '';
        statusItem.command = {
            title: 'Switch to off',
            command: Commands.Set_TypeChecking,
            arguments: ['off'],
        };
    }

    statusItem.name = LanguageService.statusItem.name;
    statusItem.text = `${LanguageService.pylanceTypeCheckingModeOffStatusItem.text}: ${typeCheckingMode}`;
}
