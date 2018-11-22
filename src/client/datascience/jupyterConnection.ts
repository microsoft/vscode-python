// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ChildProcess } from 'child_process';
import * as tk from 'tree-kill';
import * as path from 'path';
import { Disposable } from 'vscode-jsonrpc';

import { ObservableExecutionResult, Output } from '../common/process/types';
import { ILogger, IConfigurationService } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { IConnection } from './types';
import { IServiceContainer } from '../ioc/types';
import { IFileSystem } from '../common/platform/types';
import * as localize from '../common/utils/localize';

const UrlPatternRegEx = /(https?:\/\/[^\s]+)/ ;
const ForbiddenPatternRegEx = /Forbidden/;
const HttpPattern = /https?:\/\//;

class ProcessDisposable implements Disposable {
    private proc: ChildProcess | undefined;

    constructor(proc: ChildProcess) {
        this.proc = proc;
    }

    dispose = () => {
        if (this.proc) {
            if (!this.proc.killed) {
                tk(this.proc.pid);
            }
        }
    }
}
export type JupyterServerInfo = [string, string, string, boolean, number, number, boolean, string, string];

class JupyterConnectionWaiter {
    private startPromise: Deferred<JupyterConnection>;
    private launchTimeout: NodeJS.Timer;
    private configService: IConfigurationService;
    private logger: ILogger;
    private fileSystem: IFileSystem;
    private processDisposable: ProcessDisposable;
    private notebook_dir: string;
    private pythonMainVersionNumber: number;
    private getServerInfo : () => Promise<JupyterServerInfo[]>;


    constructor(launchResult : ObservableExecutionResult<string>, pythonVersion: number, notebookFile: string, getServerInfo: () => Promise<JupyterServerInfo[]>, serviceContainer: IServiceContainer) {
    	this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.logger = serviceContainer.get<ILogger>(ILogger);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.pythonMainVersionNumber = pythonVersion;
        this.getServerInfo = getServerInfo;

        // Compute our notebook dir
        this.notebook_dir = path.dirname(notebookFile);

        // Rememeber our process so we can pass it onto the connection or destroy it
        this.processDisposable = new ProcessDisposable(launchResult.proc);

        // Setup our start promise
        this.startPromise = createDeferred<JupyterConnection>();

        // We want to reject our Jupyter connection after a specific timeout
        const settings = this.configService.getSettings();
        const jupyterLaunchTimeout = settings.datascience.jupyterLaunchTimeout;

        this.launchTimeout = setTimeout(() => {
            this.launchTimedOut();
        }, jupyterLaunchTimeout);

        // Listen on stderr for its connection information
        launchResult.out.subscribe((output : Output<string>) => {
            if (output.source === 'stderr') {
                this.extractConnectionInformation(output.out);
            } else {
                this.output(output.out);
            }
        });

    }

    public waitForConnection() : Promise<JupyterConnection> {
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
    private getJupyterURL(serverInfos: JupyterServerInfo[], data: any) {
        if (serverInfos && !this.startPromise.completed) {
            const matchInfo = serverInfos.find(info => this.fileSystem.arePathsSame(this.notebook_dir, info['notebook_dir']));
            if (matchInfo) {
                const url = matchInfo['url'];
                const token = matchInfo['token'];
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
            var URL = require('url').URL;
            let url: URL;
            try {
                url = new URL(urlMatch[0]);
            } catch (err) {
                // Failed to parse the url either via server infos or the string
                this.rejectStartPromise(new Error(localize.DataScience.jupyterLaunchNoURL()));
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
            this.getServerInfo().then(serverInfos => {
                this.getJupyterURL(serverInfos, data);
            }).ignoreErrors();
        }

        // Look for 'Forbidden' in the result
        const forbiddenMatch = ForbiddenPatternRegEx.exec(data);
        if (forbiddenMatch && this.startPromise && !this.startPromise.resolved) {
            this.rejectStartPromise(new Error(data.toString('utf8')));
        }
    }

    private launchTimedOut = () => {
        if (!this.startPromise.completed) {
            this.rejectStartPromise(new Error(localize.DataScience.jupyterLaunchTimedOut()));
        }
    }

    private resolveStartPromise = (baseUrl: string, token: string) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.resolve(new JupyterConnection(baseUrl, token, this.pythonMainVersionNumber, this.processDisposable));
    }

    // tslint:disable-next-line:no-any
    private rejectStartPromise = (reason?: any) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.reject(reason);
    }

}

// Represents an active connection to a running jupyter notebook
export class JupyterConnection implements IConnection {
    public baseUrl: string;
    public token: string;
    public pythonMainVersion: number;
    private disposable: Disposable | undefined;
    constructor(baseUrl: string, token: string, pythonMainVersion: number, disposable: Disposable) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.disposable = disposable;
        this.pythonMainVersion = pythonMainVersion;
    }

    public dispose() {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = undefined;
        }
    }

    public static waitForConnection(
        notebookFile: string,
        getServerInfo: () => Promise<JupyterServerInfo[]>,
        notebookExecution : ObservableExecutionResult<string>,
        pythonVersion: number,
        serviceContainer: IServiceContainer) {
        const waiter = new JupyterConnectionWaiter(notebookExecution, pythonVersion, notebookFile, getServerInfo, serviceContainer);
        return waiter.waitForConnection();
    }
}


