// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { inject, injectable } from 'inversify';
import * as tk from 'tree-kill';
import { URL } from 'url';

import { IFileSystem } from '../common/platform/types';
import { ExecutionResult, IPythonExecutionFactory, ObservableExecutionResult, Output, PythonVersionInfo } from '../common/process/types';
import { IConfigurationService, ILogger} from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IJupyterExecution, INotebookProcess, JupyterServerInfo } from './types';

export interface IConnectionInfo {
    baseUrl: string;
    token: string;
}

// This class communicates with an instance of jupyter that's running in the background
@injectable()
export class JupyterProcess implements INotebookProcess {
    private static urlPattern = /(https?:\/\/[^\s]+)/;
    private static forbiddenPattern = /Forbidden/;
    private static httpPattern = /https?:\/\//;
    public isDisposed: boolean = false;
    private startPromise: Deferred<IConnectionInfo> | undefined;
    private startObservable: ObservableExecutionResult<string> | undefined;
    private launchTimeout: NodeJS.Timer;

    private notebook_dir: string;

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(ILogger) private logger: ILogger) {
    }

    public start = async (notebookdir: string) : Promise<void> => {
        // Compute args based on if inside a workspace or not
        const args: string [] = ['notebook', '--no-browser', `--notebook-dir=${notebookdir}`];

        // Setup our start promise
        this.startPromise = createDeferred<IConnectionInfo>();

        // Use the IPythonExecutionService to find Jupyter
        this.startObservable = await this.jupyterExecution.execModuleObservable('jupyter', args, { throwOnStdErr: false, encoding: 'utf8'});
        // Save our notebook dir as we will use this to verify when we started up
        this.notebook_dir = notebookdir;

        // We want to reject our Jupyter connection after a specific timeout
        const settings = this.configService.getSettings();
        const jupyterLaunchTimeout = settings.datascience.jupyterLaunchTimeout;

        if (this.launchTimeout) {
            clearTimeout(this.launchTimeout);
        }
        this.launchTimeout = setTimeout(() => {
            this.launchTimedOut();
        }, jupyterLaunchTimeout);

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
        clearTimeout(this.launchTimeout);
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
        return this.jupyterExecution.execModule('jupyter', args, {throwOnStdErr: true, encoding: 'utf8'});
    }

    public async waitForPythonVersionString() : Promise<string> {
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();
        return info ? info.version : '3';
    }

    public async waitForPythonVersion() : Promise<PythonVersionInfo | undefined> {
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();
        return info ? info.version_info : undefined;
    }

    public async waitForPythonPath() : Promise<string | undefined> {
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();
        return info ? info.path : undefined;
    }

    // Returns the information necessary to talk to this instance
    public waitForConnectionInformation() : Promise<IConnectionInfo> {
        if (this.startPromise) {
            return this.startPromise!.promise;
        }

        clearTimeout(this.launchTimeout);
        return Promise.resolve({ baseUrl: '', token: ''});
    }

    public dispose() {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.shutdown().ignoreErrors();
        }
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

                this.resolveStartPromise({ baseUrl: url, token: token });
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
        const urlMatch = JupyterProcess.urlPattern.exec(data);
        if (urlMatch && !this.startPromise.completed) {
            let url: URL;
            try {
                url = new URL(urlMatch[0]);
            } catch (err) {
                // Failed to parse the url either via server infos or the string
                this.rejectStartPromise(new Error(localize.DataScience.jupyterLaunchNoURL()));
                return;
            }

            // Here we parsed the URL correctly
            this.resolveStartPromise({ baseUrl: `${url.protocol}//${url.host}${url.pathname}`, token: `${url.searchParams.get('token')}`});
        }
    }

    // tslint:disable-next-line:no-any
    private extractConnectionInformation = (data: any) => {
        this.output(data);

        const httpMatch = JupyterProcess.httpPattern.exec(data);

        if (httpMatch && this.notebook_dir && this.startPromise && !this.startPromise.completed) {
            // .then so that we can keep from pushing aync up to the subscribed observable function
            this.jupyterExecution.getJupyterServerInfo().then(serverInfos => {
                this.getJupyterURL(serverInfos, data);
            }).ignoreErrors();
        }

        // Look for 'Forbidden' in the result
        const forbiddenMatch = JupyterProcess.forbiddenPattern.exec(data);
        if (forbiddenMatch && this.startPromise && !this.startPromise.resolved) {
            this.rejectStartPromise(new Error(data.toString('utf8')));
        }
    }

    private launchTimedOut = () => {
        if (!this.startPromise.completed) {
            this.rejectStartPromise(new Error(localize.DataScience.jupyterLaunchTimedOut()));
        }
    }

    private resolveStartPromise = (value?: IConnectionInfo | PromiseLike<IConnectionInfo>) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.resolve(value);
    }

    // tslint:disable-next-line:no-any
    private rejectStartPromise = (reason?: any) => {
        clearTimeout(this.launchTimeout);
        this.startPromise.reject(reason);
    }

}
