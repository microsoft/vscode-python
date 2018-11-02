// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as tk from 'tree-kill';
import { URL } from 'url';

import { ExecutionResult, IPythonExecutionFactory, ObservableExecutionResult, Output } from '../common/process/types';
import { ILogger } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { IJupyterExecution, INotebookProcess } from './types';

export interface IConnectionInfo {
    baseUrl: string;
    token: string;
}

// This class communicates with an instance of jupyter that's running in the background
@injectable()
export class JupyterProcess implements INotebookProcess {
    private static urlPattern = /http:\/\/localhost:[0-9]+\/\?token=[a-z0-9]+/g;
    public isDisposed: boolean = false;
    private startPromise: Deferred<IConnectionInfo> | undefined;
    private startObservable: ObservableExecutionResult<string> | undefined;

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution,
        @inject(ILogger) private logger: ILogger) {
    }

    public start = async (notebookdir: string) : Promise<void> => {

        // Compute args based on if inside a workspace or not
        const args: string [] = ['notebook', '--no-browser', `--notebook-dir=${notebookdir}`];

        // Setup our start promise
        this.startPromise = createDeferred<IConnectionInfo>();

        // Use the IPythonExecutionService to find Jupyter
        this.startObservable = await this.jupyterExecution.execModuleObservable(args, { throwOnStdErr: false, encoding: 'utf8'});

        // Listen on stderr for its connection information
        this.startObservable.out.subscribe((output : Output<string>) => {
            if (output.source === 'stderr') {
                this.extractConnectionInformation(output.out);
            } else {
                this.output(output.out);
            }
        });
    }

    public shutdown = async () : Promise<void> => {
        if (this.startObservable && this.startObservable.proc) {
            if (!this.startObservable.proc.killed) {
                tk(this.startObservable.proc.pid);
            }
            this.startObservable = undefined;
        }
    }

    public spawn = async (notebookFile: string) : Promise<ExecutionResult<string>> => {

        // Compute args for the file
        const args: string [] = ['notebook', `--NotebookApp.file_to_run=${notebookFile}`];

        // Use the IPythonExecutionService to find Jupyter
        return this.jupyterExecution.execModule(args, {throwOnStdErr: true, encoding: 'utf8'});
    }

    public async waitForPythonVersionString() : Promise<string> {
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();
        return info ? info.version : '3';
    }

    // Returns the information necessary to talk to this instance
    public waitForConnectionInformation() : Promise<IConnectionInfo> {
        if (this.startPromise) {
            return this.startPromise!.promise;
        }

        return Promise.resolve({ baseUrl: '', token: ''});
    }

    public dispose() {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.shutdown().ignoreErrors();
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
