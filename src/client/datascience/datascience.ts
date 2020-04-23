// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { JSONObject } from '@phosphor/coreutils';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PYTHON_ALLFILES, PYTHON_LANGUAGE } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import '../common/extensions';
import { IConfigurationService, IDisposable, IDisposableRegistry, IExtensionContext } from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import { sendTelemetryEvent } from '../telemetry';
import { hasCells } from './cellFactory';
import { CommandRegistry } from './commands/commandRegistry';
import { EditorContexts, Telemetry } from './constants';
import { IDataScience, IDataScienceCodeLensProvider } from './types';

@injectable()
export class DataScience implements IDataScience {
    public isDisposed: boolean = false;
    private changeHandler: IDisposable | undefined;
    private startTime: number = Date.now();
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IDataScienceCodeLensProvider) private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(CommandRegistry) private commandRegistry: CommandRegistry
    ) {
        this.disposableRegistry.push(this.commandRegistry);
    }

    public get activationStartTime(): number {
        return this.startTime;
    }

    public async activate(): Promise<void> {
        this.commandRegistry.register();

        this.extensionContext.subscriptions.push(
            vscode.languages.registerCodeLensProvider(PYTHON_ALLFILES, this.dataScienceCodeLensProvider)
        );

        // Set our initial settings and sign up for changes
        this.onSettingsChanged();
        this.changeHandler = this.configuration.getSettings(undefined).onDidChange(this.onSettingsChanged.bind(this));
        this.disposableRegistry.push(this);

        // Listen for active editor changes so we can detect have code cells or not
        this.disposableRegistry.push(
            this.documentManager.onDidChangeActiveTextEditor(() => this.onChangedActiveTextEditor())
        );
        this.onChangedActiveTextEditor();

        // Send telemetry for all of our settings
        this.sendSettingsTelemetry().ignoreErrors();
    }

    public async dispose() {
        if (this.changeHandler) {
            this.changeHandler.dispose();
            this.changeHandler = undefined;
        }
    }

    private onSettingsChanged = () => {
        const settings = this.configuration.getSettings(undefined);
        const enabled = settings.datascience.enabled;
        let editorContext = new ContextKey(EditorContexts.DataScienceEnabled, this.commandManager);
        editorContext.set(enabled).catch();
        const ownsSelection = settings.datascience.sendSelectionToInteractiveWindow;
        editorContext = new ContextKey(EditorContexts.OwnsSelection, this.commandManager);
        editorContext.set(ownsSelection && enabled).catch();
    };

    private onChangedActiveTextEditor() {
        // Setup the editor context for the cells
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);
        const activeEditor = this.documentManager.activeTextEditor;

        if (activeEditor && activeEditor.document.languageId === PYTHON_LANGUAGE) {
            // Inform the editor context that we have cells, fire and forget is ok on the promise here
            // as we don't care to wait for this context to be set and we can't do anything if it fails
            editorContext.set(hasCells(activeEditor.document, this.configuration.getSettings().datascience)).catch();
        } else {
            editorContext.set(false).catch();
        }
    }

    @debounceAsync(1)
    @swallowExceptions('Sending DataScience Settings Telemetry failed')
    private async sendSettingsTelemetry(): Promise<void> {
        // Get our current settings. This is what we want to send.
        // tslint:disable-next-line:no-any
        const settings = this.configuration.getSettings().datascience as any;

        // Translate all of the 'string' based settings into known values or not.
        const pythonConfig = this.workspace.getConfiguration('python');
        if (pythonConfig) {
            const keys = Object.keys(settings);
            const resultSettings: JSONObject = {};
            for (const k of keys) {
                const currentValue = settings[k];
                if (typeof currentValue === 'string') {
                    const inspectResult = pythonConfig.inspect<string>(`dataScience.${k}`);
                    if (inspectResult && inspectResult.defaultValue !== currentValue) {
                        resultSettings[k] = 'non-default';
                    } else {
                        resultSettings[k] = 'default';
                    }
                } else {
                    resultSettings[k] = currentValue;
                }
            }
            sendTelemetryEvent(Telemetry.DataScienceSettings, 0, resultSettings);
        }
    }
}
