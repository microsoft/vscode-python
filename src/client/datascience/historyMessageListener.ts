// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Position, Range, Selection, TextEditor, Uri, ViewColumn } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider,
    IWorkspaceService
} from '../common/application/types';
import { CancellationError } from '../common/cancellation';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IDisposable, IDisposableRegistry, ILogger } from '../common/types';
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { EditorContexts, HistoryMessages, Identifiers, Settings, Telemetry, LiveShare } from './constants';
import { JupyterInstallError } from './jupyter/jupyterInstallError';
import {
    CellState,
    ICell,
    ICodeCssGenerator,
    IConnection,
    IDataScienceExtraSettings,
    IHistory,
    IHistoryInfo,
    IJupyterExecution,
    INotebookExporter,
    INotebookServer,
    InterruptResult,
    IStatusProvider,
    IJupyterExecutionFactory
} from './types';
import { noop } from '../../test/core';
import * as vsls from 'vsls/vscode';

export enum SysInfoReason {
    Start,
    Restart,
    Interrupt
}

// This class listens to messages that come from the local Python Interactive window
export class HistoryMessageListener implements IWebPanelMessageListener {
    private started : Promise<vsls.LiveShare | undefined>;
    private hostServer : vsls.SharedService | undefined;
    private guestServer : vsls.SharedServiceProxy | undefined;
    private currentRole : vsls.Role = vsls.Role.None;

    private localCallback : (message: string, payload: any) => void;

    constructor(callback: (message: string, payload: any) => void) {
        this.localCallback = callback;
        this.started = this.startCommandServer();
    }

    public dispose() {
        noop();
    }

    public onMessage(message: string, payload: any) {
        // We received a message from the local webview. Based on our
        // current live share status, determine where to send it.

    }

    private async onChangeSession(api: vsls.LiveShare) : Promise<void> {
        // Startup or shutdown our connection to the other side
        if (api.session) {
            if (this.currentRole !== api.session.role) {
                // We're changing our role.
                if (this.hostServer) {
                    api.unshareService(LiveShare.CommandBrokerService);
                    this.hostServer = undefined;
                }
                if (this.guestServer) {
                    this.guestServer = undefined;
                }
            }

            // Startup our proxy or server
            this.currentRole = api.session.role;
            if (api.session.role === vsls.Role.Host) {
                this.hostServer = await api.shareService(LiveShare.CommandBrokerService);
            } else if (api.session.role === vsls.Role.Guest) {
                this.guestServer = await api.getSharedService(LiveShare.CommandBrokerService);

                // When we switch to guest mode, we may have to reregister all of our commands.
                this.registerGuestCommands(api);
            }
        }
    }

    private async startCommandServer() : Promise<vsls.LiveShare | undefined> {
        const api = await vsls.getApiAsync();
        if (api) {
            api.onDidChangeSession(() => this.onChangeSession(api).ignoreErrors());
            await this.onChangeSession(api);
        }
        return api;
    }

}
