// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { QuickPickItem, QuickInputButton } from 'vscode';

// Typings for the code in the python extension
export interface IPythonExtensionApi {
    /**
     * Promise indicating whether all parts of the extension have completed loading or not.
     * @type {Promise<void>}
     * @memberof IExtensionApi
     */
    ready: Promise<void>;
    datascience: {
        /**
         * Launches Data Viewer component.
         * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
         * @param {string} title Data Viewer title
         */
        showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
        /**
         * Registers a remote server provider component that's used to pick remote jupyter server URIs
         * @param serverProvider object called back when picking jupyter server URI
         */
        registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
    };
}

export interface IDataFrameInfo {
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

export enum ColumnType {
    String = 'string',
    Number = 'number',
    Bool = 'bool'
}

// tslint:disable-next-line: no-any
export type IRowsResponse = any[];

export interface IJupyterServerUri {
    baseUrl: string;
    token: string;
    // tslint:disable-next-line: no-any
    authorizationHeader: any; // JSON object for authorization header.
}

export type JupyterServerUriHandle = string;

export interface IJupyterUriProvider {
    readonly id: string; // Should be a unique string (like a guid)
    getQuickPickEntryItems(): QuickPickItem[];
    handleQuickPick(item: QuickPickItem, backEnabled: boolean): Promise<JupyterServerUriHandle | 'back' | undefined>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}
