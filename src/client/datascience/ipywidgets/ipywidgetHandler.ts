// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { traceError } from '../../common/logger';
import { IDisposableRegistry } from '../../common/types';
import { INotebookIdentity, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { IInteractiveWindowListener, INotebookProvider } from '../types';
import { IPyWidgetMessageDispatcherFactory } from './ipyWidgetMessageDispatcherFactory';
import { IIPyWidgetMessageDispatcher } from './types';

/**
 * This class handles all of the ipywidgets communication with the notebook
 */
@injectable()
//
export class IPyWidgetHandler implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }
    private ipyWidgetMessageDispatcher?: IIPyWidgetMessageDispatcher;
    private notebookIdentity: Uri | undefined;
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    constructor(
        @inject(INotebookProvider) notebookProvider: INotebookProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IPyWidgetMessageDispatcherFactory) private readonly factory: IPyWidgetMessageDispatcherFactory
    ) {
        disposables.push(
            notebookProvider.onNotebookCreated(async (e) => {
                if (e.identity.toString() === this.notebookIdentity?.toString()) {
                    await this.initialize();
                }
            })
        );
    }

    public dispose() {
        this.ipyWidgetMessageDispatcher?.dispose(); // NOSONAR
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        if (message === InteractiveWindowMessages.NotebookIdentity) {
            this.saveIdentity(payload).catch((ex) => traceError('Failed to initialize ipywidgetHandler', ex));
        }
        // tslint:disable-next-line: no-any
        this.getIPyWidgetMessageDispatcher()?.receiveMessage({ message: message as any, payload }); // NOSONAR
    }

    private getIPyWidgetMessageDispatcher() {
        if (!this.notebookIdentity) {
            return;
        }
        this.ipyWidgetMessageDispatcher = this.factory.create(this.notebookIdentity);
        return this.ipyWidgetMessageDispatcher;
    }

    private async saveIdentity(args: INotebookIdentity) {
        this.notebookIdentity = Uri.parse(args.resource);

        const dispatcher = this.getIPyWidgetMessageDispatcher();
        if (dispatcher) {
            this.disposables.push(dispatcher.postMessage((msg) => this.postEmitter.fire(msg)));
        }

        await this.initialize();
    }

    private async initialize() {
        if (!this.notebookIdentity) {
            return;
        }
        const dispatcher = this.getIPyWidgetMessageDispatcher();
        if (dispatcher) {
            await dispatcher.initialize();
        }
    }
}
