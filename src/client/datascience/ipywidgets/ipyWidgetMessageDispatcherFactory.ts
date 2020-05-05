// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { INotebook, INotebookProvider } from '../types';
import { IPyWidgetMessageDispatcher } from './ipyWidgetMessageDispatcher';
import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

/**
 * This just wraps the iPyWidgetMessageDispatcher class.
 * When raising events for arrived messages, this class will first raise events for
 * all messages that arrived before this class was contructed.
 */
class IPyWidgetMessageDispatcherWithOldMessages implements IIPyWidgetMessageDispatcher {
    public get postMessage(): Event<IPyWidgetMessage> {
        return this._postMessageEmitter.event;
    }
    private _postMessageEmitter = new EventEmitter<IPyWidgetMessage>();
    private readonly disposables: IDisposable[] = [];
    constructor(
        private readonly baseMulticaster: IPyWidgetMessageDispatcher,
        private oldMessages: ReadonlyArray<IPyWidgetMessage>
    ) {
        baseMulticaster.postMessage(this.raisePostMessage, this, this.disposables);
    }

    public dispose() {
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose(); // NOSONAR
        }
    }
    public async initialize() {
        return this.baseMulticaster.initialize();
    }

    public receiveMessage(message: IPyWidgetMessage) {
        this.baseMulticaster.receiveMessage(message);
    }
    private raisePostMessage(message: IPyWidgetMessage) {
        // Send all of the old messages the notebook may not have received.
        // Also send them in the same order.
        this.oldMessages.forEach((oldMessage) => {
            this._postMessageEmitter.fire(oldMessage);
        });
        this.oldMessages = [];
        this._postMessageEmitter.fire(message);
    }
}

/**
 * Creates the dispatcher responsible for sending the ipywidget messages to notebooks.
 * The way ipywidgets work are as follows:
 * - IpyWidget framework registers with kernel (registerCommTarget).
 * - IpyWidgets listen to messages from kernel (iopub).
 * - IpyWidgets maintain their own state.
 * - IpyWidgets build their state slowly based on messages arriving/being sent from iopub.
 * - When kernel finally sends a message `display xyz`, ipywidgets looks for data related `xyz` and displays it.
 *   I.e. by now, ipywidgets has all of the data related to `xyz`. `xyz` is merely an id.
 *   I.e. kernel merely sends a message saying `ipywidgets please display the UI related to id xyz`.
 *   The terminoloy used by ipywidgest for the identifier is the `model id`.
 *
 * Now, if we have another UI opened for the same notebook, e.g. multiple notebooks, we need all of this informaiton.
 * I.e. ipywidgets needs all of the information prior to the `display xyz command` form kernel.
 * For this to happen, ipywidgets needs to be sent all of the messages from the time it reigstered for a comm target in the original notebook.
 *
 * Solution:
 * - Save all of the messages sent to ipywidgets.
 * - When we open a new notebook, then re-send all of these messages to this new ipywidgets manager in the second notebook.
 * - Now, both ipywidget managers in both notebooks have the same data, hence are able to render the same controls.
 */
@injectable()
export class IPyWidgetMessageDispatcherFactory implements IDisposable {
    private readonly messageDispatchers = new Map<string, IPyWidgetMessageDispatcher>();
    private readonly messages: IPyWidgetMessage[] = [];
    private disposed = false;
    private disposables: IDisposable[] = [];
    constructor(
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        disposables.push(this);
        notebookProvider.onNotebookCreated((e) => this.trackDisposingOfNotebook(e.notebook), this, this.disposables);

        notebookProvider.activeNotebooks.forEach((nbPromise) =>
            nbPromise.then((notebook) => this.trackDisposingOfNotebook(notebook)).ignoreErrors()
        );
    }

    public dispose() {
        this.disposed = true;
        while (this.disposables.length) {
            this.disposables.shift()?.dispose(); // NOSONAR
        }
    }
    public create(identity: Uri): IIPyWidgetMessageDispatcher {
        let baseDispatcher = this.messageDispatchers.get(identity.fsPath);
        if (!baseDispatcher) {
            baseDispatcher = new IPyWidgetMessageDispatcher(this.notebookProvider, identity);
            this.messageDispatchers.set(identity.fsPath, baseDispatcher);

            // Capture all messages so we can re-play messages that others missed.
            this.disposables.push(baseDispatcher.postMessage(this.onMessage, this));
        }

        // If we have messages upto this point, then capture those messages,
        // & pass to the dispatcher so it can re-broadcast those old messages.
        // If there are no old messages, even then return a new instance of the class.
        // This way, the reference to that will be controlled by calling code.
        const dispatcher = new IPyWidgetMessageDispatcherWithOldMessages(
            baseDispatcher,
            this.messages as ReadonlyArray<IPyWidgetMessage>
        );
        this.disposables.push(dispatcher);
        return dispatcher;
    }
    private trackDisposingOfNotebook(notebook: INotebook) {
        if (this.disposed) {
            return;
        }
        notebook.onDisposed(
            () => {
                const item = this.messageDispatchers.get(notebook.identity.fsPath);
                this.messageDispatchers.delete(notebook.identity.fsPath);
                item?.dispose(); // NOSONAR
            },
            this,
            this.disposables
        );
    }

    private onMessage(_message: IPyWidgetMessage) {
        // Disabled for now, as this has the potential to consume a lot of resources (memory).
        // One solution - store n messages in array, then use file as storage.
        // Next problem, data at rest is not encrypted, now we need to encrypt.
        // Till we decide, lets disable this.
        //this.messages.push(message);
    }
}
