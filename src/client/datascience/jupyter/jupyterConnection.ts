// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { ChildProcess } from 'child_process';
import { CancellationToken, Disposable, Event, EventEmitter } from 'vscode';
import { Cancellation, CancellationError } from '../../common/cancellation';
import { traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { ObservableExecutionResult, Output } from '../../common/process/types';
import { IConfigurationService, IDisposable } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { RegExpValues } from '../constants';
import { IConnection } from '../types';
import { JupyterConnectError } from './jupyterConnectError';

// tslint:disable-next-line:no-require-imports no-var-requires no-any
const namedRegexp = require('named-js-regexp');
const urlMatcher = namedRegexp(RegExpValues.UrlPatternRegEx);

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

export class JupyterConnectionWaiter implements IDisposable {
    private startPromise: Deferred<IConnection>;
    private launchTimeout: NodeJS.Timer | number;
    private configService: IConfigurationService;
    private fileSystem: IFileSystem;
    private stderr: string[] = [];
    private connectionDisposed = false;

    constructor(
        private readonly launchResult: ObservableExecutionResult<string>,
        private readonly notebookDir: string,
        private readonly getServerInfo: (cancelToken?: CancellationToken) => Promise<JupyterServerInfo[] | undefined>,
        serviceContainer: IServiceContainer,
        private readonly cancelToken?: CancellationToken
    ) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);

        // Cancel our start promise if a cancellation occurs
        if (cancelToken) {
            cancelToken.onCancellationRequested(() => this.startPromise.reject(new CancellationError()));
        }

        // Setup our start promise
        this.startPromise = createDeferred<IConnection>();

        // We want to reject our Jupyter connection after a specific timeout
        const settings = this.configService.getSettings();
        const jupyterLaunchTimeout = settings.datascience.jupyterLaunchTimeout;

        this.launchTimeout = setTimeout(() => {
            this.launchTimedOut();
        }, jupyterLaunchTimeout);

        // Listen for crashes
        let exitCode = '0';
        if (launchResult.proc) {
            launchResult.proc.on('exit', c => (exitCode = c ? c.toString() : '0'));
        }
        let stderr = '';
        // Listen on stderr for its connection information
        launchResult.out.subscribe(
            (output: Output<string>) => {
                if (output.source === 'stderr') {
                    stderr += output.out;
                    this.stderr.push(output.out);
                    this.extractConnectionInformation(stderr);
                } else {
                    this.output(output.out);
                }
            },
            e => this.rejectStartPromise(e.message),
            // If the process dies, we can't extract connection information.
            () => this.rejectStartPromise(localize.DataScience.jupyterServerCrashed().format(exitCode))
        );
    }
    public dispose() {
        // tslint:disable-next-line: no-any
        clearTimeout(this.launchTimeout as any);
    }

    public waitForConnection(): Promise<IConnection> {
        return this.startPromise.promise;
    }

    private createConnection(baseUrl: string, token: string, hostName: string, processDisposable: Disposable) {
        // tslint:disable-next-line: no-use-before-declare
        return new JupyterConnection(baseUrl, token, hostName, processDisposable, this.launchResult.proc);
    }

    // tslint:disable-next-line:no-any
    private output = (data: any) => {
        if (!this.connectionDisposed) {
            traceInfo(data.toString('utf8'));
        }
    };

    // From a list of jupyter server infos try to find the matching jupyter that we launched
    // tslint:disable-next-line:no-any
    private getJupyterURL(serverInfos: JupyterServerInfo[] | undefined, data: any) {
        if (serverInfos && serverInfos.length > 0 && !this.startPromise.completed) {
            const matchInfo = serverInfos.find(info =>
                this.fileSystem.arePathsSame(this.notebookDir, info.notebook_dir)
            );
            if (matchInfo) {
                const url = matchInfo.url;
                const token = matchInfo.token;
                const host = matchInfo.hostname;
                this.resolveStartPromise(url, token, host);
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
        // tslint:disable-next-line:no-any
        const urlMatch = urlMatcher.exec(data) as any;
        const groups = urlMatch.groups() as RegExpValues.IUrlPatternGroupType;
        if (urlMatch && !this.startPromise.completed && groups && (groups.LOCAL || groups.IP)) {
            // Rebuild the URI from our group hits
            const host = groups.LOCAL ? groups.LOCAL : groups.IP;
            const uriString = `${groups.PREFIX}${host}${groups.REST}`;

            // URL is not being found for some reason. Pull it in forcefully
            // tslint:disable-next-line:no-require-imports
            const URL = require('url').URL;
            let url: URL;
            try {
                url = new URL(uriString);
            } catch (err) {
                // Failed to parse the url either via server infos or the string
                this.rejectStartPromise(localize.DataScience.jupyterLaunchNoURL());
                return;
            }

            // Here we parsed the URL correctly
            this.resolveStartPromise(
                `${url.protocol}//${url.host}${url.pathname}`,
                `${url.searchParams.get('token')}`,
                url.hostname
            );
        }
    }

    // tslint:disable-next-line:no-any
    private extractConnectionInformation = (data: any) => {
        this.output(data);

        const httpMatch = RegExpValues.HttpPattern.exec(data);

        if (httpMatch && this.notebookDir && this.startPromise && !this.startPromise.completed && this.getServerInfo) {
            // .then so that we can keep from pushing aync up to the subscribed observable function
            this.getServerInfo(this.cancelToken)
                .then(serverInfos => this.getJupyterURL(serverInfos, data))
                .catch(ex => traceWarning('Failed to get server info', ex));
        }

        // Sometimes jupyter will return a 403 error. Not sure why. We used
        // to fail on this, but it looks like jupyter works with this error in place.
    };

    private launchTimedOut = () => {
        if (!this.startPromise.completed) {
            this.rejectStartPromise(localize.DataScience.jupyterLaunchTimedOut());
        }
    };

    private resolveStartPromise = (baseUrl: string, token: string, hostName: string) => {
        // tslint:disable-next-line: no-any
        clearTimeout(this.launchTimeout as any);
        if (!this.startPromise.rejected) {
            const connection = this.createConnection(baseUrl, token, hostName, this.launchResult);
            const origDispose = connection.dispose.bind(connection);
            connection.dispose = () => {
                // Stop listening when we disconnect
                this.connectionDisposed = true;
                return origDispose();
            };
            this.startPromise.resolve(connection);
        }
    };

    // tslint:disable-next-line:no-any
    private rejectStartPromise = (message: string) => {
        // tslint:disable-next-line: no-any
        clearTimeout(this.launchTimeout as any);
        if (!this.startPromise.resolved) {
            this.startPromise.reject(
                Cancellation.isCanceled(this.cancelToken)
                    ? new CancellationError()
                    : new JupyterConnectError(message, this.stderr.join('\n'))
            );
        }
    };
}

// Represents an active connection to a running jupyter notebook
class JupyterConnection implements IConnection {
    public readonly localLaunch: boolean = true;
    public localProcExitCode: number | undefined;
    private eventEmitter: EventEmitter<number> = new EventEmitter<number>();
    constructor(
        public readonly baseUrl: string,
        public readonly token: string,
        public readonly hostName: string,
        private readonly disposable: Disposable,
        childProc: ChildProcess | undefined
    ) {
        // If the local process exits, set our exit code and fire our event
        if (childProc) {
            childProc.on('exit', c => {
                // Our code expects the exit code to be of type `number` or `undefined`.
                const code = typeof c === 'number' ? c : undefined;
                this.localProcExitCode = code;
                this.eventEmitter.fire(code);
            });
        }
    }

    public get disconnected(): Event<number> {
        return this.eventEmitter.event;
    }

    public dispose() {
        if (this.disposable) {
            this.disposable.dispose();
        }
    }
}
