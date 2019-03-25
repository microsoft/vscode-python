// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ViewColumn } from 'vscode';

import { IWebPanel, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { IAsyncDisposable, IConfigurationService, IDisposable, ILogger } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ICodeCssGenerator, IDataExplorer, IDataExplorerRow, IDataScienceExtraSettings } from '../types';
import { DataExplorerMessageListener } from './dataExplorerMessageListener';
import { DataExplorerMessages, IDataExplorerMapping } from './types';

@injectable()
export class DataExplorer implements IDataExplorer, IAsyncDisposable {
    private disposed: boolean = false;
    private webPanel: IWebPanel | undefined;
    private webPanelInit: Deferred<void>;
    private loadPromise: Promise<void>;
    private messageListener : DataExplorerMessageListener;
    private changeHandler: IDisposable | undefined;
    private viewState : { visible: boolean; active: boolean } = { visible: false, active: false };

    constructor(
        @inject(IWebPanelProvider) private provider: IWebPanelProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICodeCssGenerator) private cssGenerator: ICodeCssGenerator,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(ILogger) private logger: ILogger
        ) {
        this.changeHandler = this.configuration.getSettings().onDidChange(this.onSettingsChanged.bind(this));

        // Create a message listener to listen to messages from our webpanel (or remote session)
        this.messageListener = new DataExplorerMessageListener(this.onMessage, this.onViewStateChanged, this.dispose);

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webPanelInit = createDeferred();

        // Load on a background thread.
        this.loadPromise = this.loadWebPanel();
    }

    public get ready() : Promise<void> {
        // We need this to ensure the history window is up and ready to receive messages.
        return this.loadPromise;
    }

    public async show(_rows: IDataExplorerRow[]): Promise<void> {
        if (!this.disposed) {
            // Make sure we're loaded first
            await this.loadPromise;

            // Then show our web panel. Eventually we need to consume the data
            if (this.webPanel) {
                await this.webPanel.show(true);

                // Send telemetry when it works.
                sendTelemetryEvent(Telemetry.ShowDataExplorer);
            }
        }
    }

    public dispose = async () => {
        if (!this.disposed) {
            this.disposed = true;
            if (this.webPanel) {
                this.webPanel.close();
                this.webPanel = undefined;
            }
            if (this.changeHandler) {
                this.changeHandler.dispose();
                this.changeHandler = undefined;
            }
        }
    }

    private async postMessage<M extends IDataExplorerMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        if (this.webPanel) {
            // Make sure the webpanel is up before we send it anything.
            await this.webPanelInit.promise;

            // Then send it the message
            this.webPanel.postMessage({ type: type.toString(), payload: payload });
        }
    }

    // tslint:disable-next-line: no-any no-empty
    private onMessage = (message: string, _payload: any) => {
        switch (message) {
            case DataExplorerMessages.Started:
                this.webPanelRendered();
                break;

            default:
                break;
        }
    }

    private onViewStateChanged = (webPanel: IWebPanel) => {
        this.viewState.active = webPanel.isActive();
        this.viewState.visible = webPanel.isVisible();
    }

    // tslint:disable-next-line:no-any
    private webPanelRendered() {
        if (!this.webPanelInit.resolved) {
            this.webPanelInit.resolve();
        }
    }

    // Post a message to our webpanel and update our new datascience settings
    private onSettingsChanged = () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(this.generateDataScienceExtraSettings());
        this.postMessage(DataExplorerMessages.UpdateSettings, dsSettings).ignoreErrors();
    }

    private generateDataScienceExtraSettings() : IDataScienceExtraSettings {
        const terminal = this.workspaceService.getConfiguration('terminal');
        const terminalCursor = terminal ? terminal.get<string>('integrated.cursorStyle', 'block') : 'block';
        return {
            ...this.configuration.getSettings().datascience,
            extraSettings: {
                terminalCursor: terminalCursor
            }
        };
    }

    private loadWebPanel = async (): Promise<void> => {
        this.logger.logInformation(`Loading web panel. Panel is ${this.webPanel ? 'set' : 'notset'}`);

        // Create our web panel (it's the UI that shows up for the history)
        if (this.webPanel === undefined) {
            // Figure out the name of our main bundle. Should be in our output directory
            const mainScriptPath = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'data-explorer', 'index_bundle.js');

            this.logger.logInformation('Generating CSS...');
            // Generate a css to put into the webpanel for viewing code
            const css = await this.cssGenerator.generateThemeCss();

            // Get our settings to pass along to the react control
            const settings = this.generateDataScienceExtraSettings();

            this.logger.logInformation('Loading web view...');
            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = this.provider.create(ViewColumn.One, this.messageListener, localize.DataScience.dataExplorerTitle(), mainScriptPath, css, settings);

            this.logger.logInformation('Web view created.');
        }
    }
}
