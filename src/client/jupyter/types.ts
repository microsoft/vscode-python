// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { QuickPickItem } from 'vscode';

interface IJupyterServerUri {
    baseUrl: string;
    token: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizationHeader: any; // JSON object for authorization header.
    expiration?: Date; // Date/time when header expires and should be refreshed.
    displayName: string;
}

type JupyterServerUriHandle = string;

export interface IJupyterUriProvider {
    readonly id: string; // Should be a unique string (like a guid)
    getQuickPickEntryItems(): QuickPickItem[];
    handleQuickPick(item: QuickPickItem, backEnabled: boolean): Promise<JupyterServerUriHandle | 'back' | undefined>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}

interface IDataFrameInfo {
    columns?: { key: string; type: ColumnType }[];
    indexColumn?: string;
    rowCount?: number;
}

export interface IDataViewerDataProvider {
    dispose(): void;
    getDataFrameInfo(): Promise<IDataFrameInfo>;
    getAllRows(): Promise<IRowsResponse>;
    getRows(start: number, end: number): Promise<IRowsResponse>;
}

enum ColumnType {
    String = 'string',
    Number = 'number',
    Bool = 'bool',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IRowsResponse = any[];

// Note: While #16102 is being worked on, this enum will be updated as we add ways to display this notification.
export enum JupyterNotInstalledOrigin {
    StartPageCreateBlankNotebook = 'startpage_create_blank_notebook',
    StartPageCreateJupyterNotebook = 'startpage_create_jupyter_notebook',
    StartPageCreateSampleNotebook = 'startpage_sample_notebook',
    StartPageUseInteractiveWindow = 'startpage_use_interactive_window',
}

export const IJupyterNotInstalledNotificationHelper = Symbol('IJupyterNotInstalledNotificationHelper');
export interface IJupyterNotInstalledNotificationHelper {
    shouldShowJupypterExtensionNotInstalledPrompt(): boolean;
    jupyterNotInstalledPrompt(entrypoint: JupyterNotInstalledOrigin): Promise<void>;
}
