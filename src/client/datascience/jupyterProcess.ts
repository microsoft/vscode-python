// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDisposable } from '@phosphor/disposable';
import * as tk from 'tree-kill';
import { URL } from 'url';
import { ExecutionResult, IPythonExecutionService, ObservableExecutionResult, Output } from '../common/process/types';
import { ILogger } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';

export interface IConnectionInfo {
    baseUrl: string;
    token: string;
}

// This class communicates with an instance of jupyter that's running in the background
export class JupyterProcess implements IDisposable {

    private static urlPattern = /http:\/\/localhost:[0-9]+\/\?token=[a-z0-9]+/g;

    public isDisposed: boolean = false;

    private startPromise: Deferred<IConnectionInfo> | undefined;
    private startObservable: ObservableExecutionResult<string> | undefined;
    private logger: ILogger | undefined;

    constructor(private pythonService: IPythonExecutionService) {

    }

    public static async exists(pythonService: IPythonExecutionService) : Promise<boolean> {
        // Spawn jupyter --version and see if it returns something
        try {
            const result = await pythonService.execModule('jupyter', ['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch {
            return false;
        }
    }

    public start(notebookdir: string, logger: ILogger) {
        this.logger = logger;

        // Compute args based on if inside a workspace or not
        const args: string [] = ['notebook', '--no-browser', `--notebook-dir=${notebookdir}`];

        // Setup our start promise
        this.startPromise = createDeferred<IConnectionInfo>();

        // Use the IPythonExecutionService to find Jupyter
        this.startObservable = this.pythonService.execModuleObservable('jupyter', args, {throwOnStdErr: false, encoding: 'utf8'});

        // Listen on stderr for its connection information
        this.startObservable.out.subscribe((output : Output<string>) => {
            if (output.source === 'stderr') {
                this.extractConnectionInformation(output.out);
            } else {
                this.output(output.out);
            }
        });
    }

    public spawn(notebookFile: string) : Promise<ExecutionResult<string>> {

        // Compute args for the file
        const args: string [] = ['notebook', `--NotebookApp.file_to_run=${notebookFile}`];

        // Use the IPythonExecutionService to find Jupyter
        return this.pythonService.execModule('jupyter', args, {throwOnStdErr: true, encoding: 'utf8'});
    }

    public async getPythonVersionString() : Promise<string> {
        const info = await this.pythonService.getInterpreterInformation();
        return info ? info.version : '3';
    }

    // Returns the information necessary to talk to this instance
    public getConnectionInformation() : Promise<IConnectionInfo> {
        if (this.startPromise) {
            return this.startPromise!.promise;
        }

        return Promise.resolve({ baseUrl: '', token: ''});
    }

    public dispose() {
        if (!this.isDisposed && this.startObservable && this.startObservable.proc) {
            this.isDisposed = true;
            if (!this.startObservable.proc.killed) {
                tk(this.startObservable.proc.pid);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private output(data: any) {
        if (this.logger) {
            this.logger.logInformation(data.toString('utf8'));
        }
    }

    // tslint:disable-next-line:no-any
    private extractConnectionInformation(data: any) {
        this.output(data);

        // Look for a Jupyter Notebook url in the string received.
        const urlMatch = JupyterProcess.urlPattern.exec(data);

        if (urlMatch && this.startPromise) {
            const url = new URL(urlMatch[0]);
            this.startPromise.resolve({ baseUrl: `${url.protocol}//${url.host}/`, token: `${url.searchParams.get('token')}` });
        }

        // Do we need to worry about this not working? Timeout?

    }
}
