// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as path from 'path';
import { CancellationToken, Disposable } from 'vscode-jsonrpc';

import { CancellationError } from '../../common/cancellation';
import { IFileSystem } from '../../common/platform/types';
import { ObservableExecutionResult, Output } from '../../common/process/types';
import { IConfigurationService, ILogger } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { JupyterConnectError } from './jupyterConnectError';
import { IConnection } from '../types';

const UrlPatternRegEx = /(https?:\/\/[^\s]+)/ ;
const HttpPattern = /https?:\/\//;

export type JupyterServerInfo = {
    base_url: string;
    notebook_dir: string;
    hostname: string;
    password: boolean;
    pid: number;
    port: number;
    secure: boolean;
    token: string;
    url: string;
};

class JupyterConnectionWaiter {
    private startPromise: Deferred<IConnection>;
    private launchTimeout: NodeJS.Timer;
    private configService: IConfigurationService;
    private logger: ILogger;
    private fileSystem: IFileSystem;
    private notebook_dir: string;
    private getServerInfo : (cancelToken?: CancellationToken) => Promise<JupyterServerInfo[] | undefined>;
    private createConnection : (b: string, t: string, p: Disposable) => IConnection;
    private launchResult : ObservableExecutionResult<string>;
    private cancelToken : CancellationToken | undefined;
    private stderr: string[] = [];

    constructor(
        launchResult : ObservableExecutionResult<string>,
        notebookFile: string,
        getServerInfo: (cancelToken?: CancellationToken) => Promise<JupyterServerInfo[] | undefined>,
        createConnection: (b: string, t: string, p: Disposable) => IConnection,
        serviceContainer: IServiceContainer,
        cancelToken?: CancellationToken) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.logger = serviceContainer.get<ILogger>(ILogger);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.getServerInfo = getServerInfo;
        this.createConnection = createConnection;
        this.launchResult = launchResult;
        this.cancelToken = cancelToken;

        // Cancel our start promise if a cancellation occurs
        if (cancelToken) {
            cancelToken.onCancellationRequested(() => this.startPromise.reject(new CancellationError()));
        }

        // Compute our notebook dir
        this.notebook_dir = path.dirname(notebookFile);

        // Setup our start promise
        this.startPromise = createDeferred<IConnection>();

        // We want to reject our Jupyter connection after a specific timeout
        const settings = this.configService.getSettings();
        const jupyterLaunchTimeout = settings.datascience.jupyterLaunchTimeout;

        this.launchTimeout = setTimeout(() => {
            this.launchTimedOut();
        }, jupyterLaunchTimeout);

        // Listen on stderr for its connection information
        launchResult.out.subscribe((output : Output<string>) => {
            if (output.source === 'stderr') {
                this.stderr.push(output.out);
                this.extractConnectionInformation(output.out);
            } else {
                this.output(output.out);
            }
        });
    }

    public waitForConnection() : Promise<IConnection> {
        return this.startPromise.promise;
    }

    // tslint:disable-next-line:no-any
    private output = (data: any) => {
        if (this.logger) {
            this.logger.logInformation(data.toString('utf8'));
        }
    }

    // From a list of jupyter server infos try to find the matching jupyter that we launched
    // tslint:disable-next-line:no-any
    private getJupyterURL(serverInfos: JupyterServerInfo[] | undefined, data: any) {
        if (serverInfos && !this.startPromise.completed) {
            const matchInfo = serverInfos.find(info => this.fileSystem.arePathsSame(this.notebook_dir, info.notebook_dir));
            if (matchInfo) {
                const url = matchInfo.url;
                const token = matchInfo.token;
                this.resolveStartPromise(url, token);
            }
        }

        // At this point we failed to get the server info or a matching server via the python code, so fall back to
        // our URL parse
        if (!this.startPromise.completed) {
            this.getJupyterURLFromString(data);
        }
    }

    // tslint:disable-next-line:no-any
    private getJupyterURLFromString(data: any) {
        const urlMatch = UrlPatternRegEx.exec(data);
        if (urlMatch && !this.startPromise.completed) {
            // URL is not being found for some reason. Pull it in forcefully
            // tslint:disable-next-line:no-require-imports
            const URL = require('url').URL;
            let url: URL;
            try {
                url = new URL(urlMatch[0]);
            } catch (err) {
                // Failed to parse the url either via server infos or the string
                this.rejectStartPromise(localize.DataScience.jupyterLaunchNoURL());
                return;
            }

            // Here we parsed the URL correctly
            this.resolveStartPromise(`${url.protocol}//${url.host}${url.pathname}`, `${url.searchParams.get('token')}`);
        }
    }

    // tslint:disable-next-line:no-any
    private extractConnectionInformation = (data: any) => {
        this.output(data);

        const httpMatch = HttpPattern.exec(data);

        if (httpMatch && this.notebook_dir && this.startPromise && !this.startPromise.completed && this.getServerInfo) {
            // .then so that we can keep from pushing aync up to the subscribed observable function
            this.getServerInfo(this.cancelToken).then(serverInfos => {
                this.getJupyterURL(serverInfos, data);
            }).ignoreErrors();
        }

        // Sometimes jupyter will return a 403 error. Not sure why. We used
        // to fail on this, but it looks like jupyter works with this error in place.
    }

    private launchTimedOut = () => {
        if (!this.startPromise.completed) {
            this.rejectStartPromise(localize.DataScience.jupyterLaunchTimedOut());
        }
    }

    private resolveStartPromise = (baseUrl: string, token: string) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.resolve(this.createConnection(baseUrl, token, this.launchResult));
    }

    // tslint:disable-next-line:no-any
    private rejectStartPromise = (message: string) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.reject(new JupyterConnectError(message, this.stderr.join('\n')));
    }

}

// Represents an active connection to a running jupyter notebook
export class JupyterConnection implements IConnection {
    public baseUrl: string;
    public token: string;
    public localLaunch: boolean;
    private disposable: Disposable | undefined;
    constructor(baseUrl: string, token: string, disposable: Disposable) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.localLaunch = true;
        this.disposable = disposable;
    }

    public static waitForConnection(
        notebookFile: string,
        getServerInfo: (cancelToken?: CancellationToken) => Promise<JupyterServerInfo[] | undefined>,
        notebookExecution : ObservableExecutionResult<string>,
        serviceContainer: IServiceContainer,
        cancelToken?: CancellationToken) {

        // Create our waiter. It will sit here and wait for the connection information from the jupyter process starting up.
        const waiter = new JupyterConnectionWaiter(
            notebookExecution,
            notebookFile,
            getServerInfo,
            (baseUrl: string, token: string, processDisposable: Disposable) => new JupyterConnection(baseUrl, token, processDisposable),
            serviceContainer,
            cancelToken);

        return waiter.waitForConnection();
    }

    public dispose() {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = undefined;
        }
    }
}
