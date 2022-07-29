// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

import { ICommandManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';

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

    private recommendedTypeMode: string | undefined;

    constructor(
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
    ) {
        this.commandManager.registerCommand(Commands.Set_TypeChecking, this.handlerUpdateTypeCheckingMode.bind(this));

        const configChangedTrigger = new DelayedTrigger(this.updateStatusItem.bind(this), 500, 'Configuration Change');
        this.configChangeTrigger = configChangedTrigger;
        this.disposables.push(configChangedTrigger);
    }

    public async activate(): Promise<void> {
        this.updateStatusItem();
        this.registerHandlers();
    }

    // eslint-disable-next-line class-methods-use-this
    private registerHandlers() {
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((e) => {
                if (
                    e.affectsConfiguration(TypeCheckingSettingName) ||
                    e.affectsConfiguration('python.languageServer')
                ) {
                    this.configChangeTrigger.trigger();
                }
            }),
        );
    }

    public dispose(): void {
        this.statusItem?.dispose();
        this.statusItem = undefined;
        this.disposables.forEach((d) => d.dispose());
    }

    public async setSettings(recommendedSettings?: { settingName: string; value: unknown }[]): Promise<void> {
        if (!this.isPylance()) {
            return;
        }

        if (recommendedSettings && recommendedSettings.length > 0) {
            recommendedSettings.forEach((setting) => {
                if (setting.settingName === TypeCheckingSettingName) {
                    this.recommendedTypeMode = setting.value ? (setting.value as string) : '';
                }
            });
        }

        await this.updateStatusItem();
    }

    private isPylance() {
        return this.configService.getSettings().languageServer === LanguageServerType.Node;
    }

    public async updateStatusItem(): Promise<void> {
        // handle clean up and creation of status item
        if (!this.isPylance()) {
            this.statusItem?.dispose();
            this.statusItem = undefined;
            return;
        }

        if (!this.statusItem) {
            this.statusItem = this.createStatusItem();
        }

        if (this.statusItem) {
            const typeCheckingMode =
                vscode.workspace.getConfiguration('python.analysis').get<string>('typeCheckingMode') ?? '';
            const inspection = vscode.workspace.getConfiguration('python.analysis').inspect<string>('typeCheckingMode');
            const isDefault = inspection?.workspaceValue === undefined && inspection?.globalValue === undefined;

            this.updateTypeCheckingStatusDetails(this.statusItem, typeCheckingMode, isDefault);
        }
    }

    public async handlerUpdateTypeCheckingMode(typeCheckingMode: string): Promise<void | undefined> {
        if (!this.isPylance()) {
            return;
        }

        await this.configService.updateSetting(
            'analysis.typeCheckingMode',
            typeCheckingMode,
            undefined,
            ConfigurationTarget.Workspace,
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private createStatusItem() {
        if (!('createLanguageStatusItem' in vscode.languages)) {
            return undefined;
        }

        const statusItem = vscode.languages.createLanguageStatusItem(TypeCheckingSettingName, {
            language: 'python',
        });

        return statusItem;
    }

    private updateTypeCheckingStatusDetails(
        statusItem: vscode.LanguageStatusItem,
        typeCheckingMode: string,
        isDefault: boolean,
    ) {
        statusItem.command = undefined;
        statusItem.name = LanguageService.statusItem.name;
        statusItem.text = `${LanguageService.pylanceTypeCheckingModeOffStatusItem.text}: ${typeCheckingMode}`;

        if (typeCheckingMode === 'off' && this.recommendedTypeMode === 'basic') {
            // Only show the dot/jiggle if the user has not set typechecking
            statusItem.severity = isDefault
                ? vscode.LanguageStatusSeverity.Warning
                : vscode.LanguageStatusSeverity.Information;
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
            statusItem.command = undefined;
        }
    }
}
