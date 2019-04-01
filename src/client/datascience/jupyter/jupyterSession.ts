// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    Contents,
    ContentsManager,
    Kernel,
    KernelMessage,
    ServerConnection,
    Session,
    SessionManager
} from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { Slot } from '@phosphor/signaling';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { Cancellation } from '../../common/cancellation';
import { isTestExecution } from '../../common/constants';
import { traceInfo } from '../../common/logger';
import { sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IConnection, IJupyterKernelSpec, IJupyterSession } from '../types';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';

export class JupyterSession implements IJupyterSession {
    private connInfo: IConnection | undefined;
    private kernelSpec: IJupyterKernelSpec | undefined;
    private sessionManager : SessionManager | undefined;
    private session: Session.ISession | undefined;
    private contentsManager: ContentsManager | undefined;
    private notebookFile: Contents.IModel | undefined;
    private onRestartedEvent : EventEmitter<void> | undefined;
    private statusHandler : Slot<Session.ISession, Kernel.Status> | undefined;
    private connected: boolean = false;

    constructor(
        connInfo: IConnection,
        kernelSpec: IJupyterKernelSpec | undefined) {
        this.connInfo = connInfo;
        this.kernelSpec = kernelSpec;
    }

    public dispose() : Promise<void> {
        return this.shutdown();
    }

    public async shutdown(): Promise<void> {
        await this.destroyKernelSpec();

        // Destroy the notebook file if not local. Local is cleaned up when we destroy the kernel spec.
        if (this.notebookFile && this.contentsManager && this.connInfo && !this.connInfo.localLaunch) {
            try {
                // Make sure we have a session first and it returns something
                if (this.sessionManager)
                {
                    await this.sessionManager.refreshRunning();
                    await this.contentsManager.delete(this.notebookFile.path);
                }
            } catch {
                noop();
            }
        }
        return this.shutdownSessionAndConnection();
    }

    public get onRestarted() : Event<void> {
        if (!this.onRestartedEvent) {
            this.onRestartedEvent = new EventEmitter<void>();
        }
        return this.onRestartedEvent.event;
    }

    public async waitForIdle() : Promise<void> {
        if (this.session && this.session.kernel) {
            // This function seems to cause CI builds to timeout randomly on
            // different tests. Waiting for status to go idle doesn't seem to work and
            // in the past, waiting on the ready promise doesn't work either. Check status with a maximum of 5 seconds
            const startTime = Date.now();
            while (this.session &&
                this.session.kernel &&
                this.session.kernel.status !== 'idle' &&
                (Date.now() - startTime < 10000)) {
                traceInfo(`Waiting for idle: ${this.session.kernel.status}`);
                await sleep(10);
            }

            // If we didn't make it out in ten seconds, indicate an error
            if (!this.session || !this.session.kernel || this.session.kernel.status !== 'idle') {
                throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
            }
        }
    }

    public restart() : Promise<void> {
        return this.session && this.session.kernel ?
            this.waitForKernelPromise(this.session.kernel.restart(), localize.DataScience.restartingKernelFailed()) :
            Promise.resolve();
    }

    public interrupt() : Promise<void> {
        return this.session && this.session.kernel ?
            this.waitForKernelPromise(this.session.kernel.interrupt(), localize.DataScience.interruptingKernelFailed()) :
            Promise.resolve();
    }

    public requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean, metadata?: JSONObject) : Kernel.IFuture | undefined {
        return this.session && this.session.kernel ? this.session.kernel.requestExecute(content, disposeOnDone, metadata) : undefined;
    }

    public async connect(cancelToken?: CancellationToken) : Promise<void> {
        if (!this.connInfo) {
            throw new Error(localize.DataScience.sessionDisposed());
        }

        // First connect to the sesssion manager
        const serverSettings = ServerConnection.makeSettings(
            {
                baseUrl: this.connInfo.baseUrl,
                token: this.connInfo.token,
                pageUrl: '',
                // A web socket is required to allow token authentication
                wsUrl: this.connInfo.baseUrl.replace('http', 'ws'),
                init: { cache: 'no-store', credentials: 'same-origin' }
            });
        this.sessionManager = new SessionManager({ serverSettings: serverSettings });

        // Create a temporary .ipynb file to use
        this.contentsManager = new ContentsManager({ serverSettings: serverSettings });
        this.notebookFile = await this.contentsManager.newUntitled({type: 'notebook'});

        // Create our session options using this temporary notebook and our connection info
        const options: Session.IOptions = {
            path: this.notebookFile.path,
            kernelName: this.kernelSpec ? this.kernelSpec.name : '',
            serverSettings: serverSettings
        };

        // Start a new session
        this.session = await Cancellation.race(() => this.sessionManager!.startNew(options), cancelToken);

        // Listen for session status changes
        this.statusHandler = this.onStatusChanged.bind(this.onStatusChanged);
        this.session.statusChanged.connect(this.statusHandler);

        // Made it this far, we're connected now
        this.connected = true;
    }

    public get isConnected() : boolean {
        return this.connected;
    }

    private async waitForKernelPromise(kernelPromise: Promise<void>, errorMessage: string, secondTime?: boolean) : Promise<void> {
        // Wait for five seconds for this kernel promise to happen
        await Promise.race([kernelPromise, sleep(5000)]);

        // If that didn't work, check status. Might have just not responded.
        if (this.session && this.session.kernel && this.session.kernel.status === 'idle') {
            return;
        }

        // Otherwise wait another 5 seconds and check again
        if (!secondTime) {
            return this.waitForKernelPromise(kernelPromise, errorMessage, true);
        }

        // If this is our second try, then show an error
        throw new Error(errorMessage);
    }

    private onStatusChanged(_s: Session.ISession, a: Kernel.Status) {
        traceInfo(`Status changed to ${a} from OnStatusChangedEvent`);
        if (a === 'starting' && this.onRestartedEvent) {
            this.onRestartedEvent.fire();
        }
    }

    private async destroyKernelSpec() {
        try {
            if (this.kernelSpec) {
                await this.kernelSpec.dispose(); // This should delete any old kernel specs
            }
        } catch {
            noop();
        }
        this.kernelSpec = undefined;
    }

    //tslint:disable:cyclomatic-complexity
    private async shutdownSessionAndConnection(): Promise<void> {
        if (this.contentsManager) {
            this.contentsManager.dispose();
            this.contentsManager = undefined;
        }
        if (this.session || this.sessionManager) {
            try {
                if (this.statusHandler && this.session) {
                    this.session.statusChanged.disconnect(this.statusHandler);
                    this.statusHandler = undefined;
                }
                if (this.session) {
                    try {
                        // When running under a test, mark all futures as done so we
                        // don't hit this problem:
                        // https://github.com/jupyterlab/jupyterlab/issues/4252
                        // tslint:disable:no-any
                        if (isTestExecution()) {
                            if (this.session && this.session.kernel) {
                                const defaultKernel = this.session.kernel as any;
                                if (defaultKernel && defaultKernel._futures) {
                                    const futures = defaultKernel._futures as Map<any, any>;
                                    if (futures) {
                                        futures.forEach(f => {
                                            if (f._status !== undefined) {
                                                f._status |= 4;
                                            }
                                        });
                                    }
                                }
                            }
                        }

                        // Shutdown may fail if the process has been killed
                        await Promise.race([this.session.shutdown(), sleep(1000)]);
                    } catch {
                        noop();
                    }
                    if (this.session && !this.session.isDisposed) {
                        this.session.dispose();
                    }
                }
                if (this.sessionManager && !this.sessionManager.isDisposed) {
                    this.sessionManager.dispose();
                }
            } catch {
                noop();
            }
            this.session = undefined;
            this.sessionManager = undefined;
        }
        if (this.onRestartedEvent) {
            this.onRestartedEvent.dispose();
        }
        if (this.connInfo) {
            this.connInfo.dispose(); // This should kill the process that's running
            this.connInfo = undefined;
        }
    }

}
