// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ChildProcess } from 'child_process';
import * as tk from 'tree-kill';
import { Disposable } from 'vscode-jsonrpc';

import { ObservableExecutionResult, Output } from '../common/process/types';
import { ILogger } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { IConnection } from './types';


const UrlPatternRegEx = /http:\/\/localhost:[0-9]+\/\?token=[a-z0-9]+/;
const ForbiddenPatternRegEx = /Forbidden/;

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

    public static waitForConnection(launchResult : ObservableExecutionResult<string>, pythonVersion: number, logger: ILogger) : Promise<JupyterConnection> {
        const deferred = createDeferred<JupyterConnection>();
        const disposable = new ProcessDisposable(launchResult.proc);

        // Listen on stderr for its connection information
        launchResult.out.subscribe((output: Output<string>) => {
            if (output.source === 'stderr') {
                JupyterConnection.extractConnectionInformation(output.out, pythonVersion, disposable, deferred, logger);
            } else {
                JupyterConnection.output(output.out, logger);
            }
        });

        return deferred.promise;
    }

    private static output(data: string, logger: ILogger) {
        if (logger) {
            logger.logInformation(data);
        }
    }

    private static extractConnectionInformation(
        data: string,
        pythonVersion: number,
        disposable: Disposable,
        waitingPromise: Deferred<JupyterConnection>,
        logger: ILogger) {

        JupyterConnection.output(data, logger);

        // Look for a Jupyter Notebook url in the string received.
        const urlMatch = UrlPatternRegEx.exec(data);

        // If we have a match, resolve the waiting promise
        if (urlMatch && urlMatch != null && urlMatch.length > 0 && waitingPromise) {
            var URL = require('url').URL;
            const url = new URL(urlMatch[0]);
            waitingPromise.resolve(new JupyterConnection(`${url.protocol}//${url.host}/`,  `${url.searchParams.get('token')}`, pythonVersion, disposable));
        }

        // Do we need to worry about this not working? Timeout?

        // Look for 'Forbidden' in the result
        const forbiddenMatch = ForbiddenPatternRegEx.exec(data);
        if (forbiddenMatch && waitingPromise && !waitingPromise.resolved) {
            waitingPromise.reject(new Error(data));
        }

    }
}


