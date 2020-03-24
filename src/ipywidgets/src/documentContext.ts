// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IClientSession } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookModel } from '@jupyterlab/notebook/lib';
import { IRenderMime } from '@jupyterlab/rendermime';
import { Contents, Kernel, KernelMessage, Session } from '@jupyterlab/services';
import { Widget } from '@phosphor/widgets';
import { Signal } from './signal';
// tslint:disable: no-any
export class DocumentContext implements DocumentRegistry.IContext<INotebookModel>, IClientSession {
    public pathChanged = new Signal<this, string>();
    public fileChanged = new Signal<this, Contents.IModel>();
    public saveState = new Signal<this, DocumentRegistry.SaveState>();
    public disposed = new Signal<this, void>();
    public model: INotebookModel;
    public session: IClientSession = this;
    public path: string;
    public localPath: string;
    public contentsModel: Contents.IModel;
    public urlResolver: IRenderMime.IResolver;
    public isReady: boolean;
    public ready: Promise<void>;
    public isDisposed: boolean;
    public terminated = new Signal<this, void>();
    public kernelChanged = new Signal<this, Session.IKernelChangedArgs>();
    public statusChanged = new Signal<this, Kernel.Status>();
    public iopubMessage = new Signal<this, KernelMessage.IMessage>();
    public unhandledMessage = new Signal<this, KernelMessage.IMessage>();
    public propertyChanged = new Signal<this, 'path' | 'name' | 'type'>();
    public name: string;
    public type: string;
    public status: Kernel.Status;
    public kernelPreference: IClientSession.IKernelPreference;
    public kernelDisplayName: string;
    constructor(public kernel: Kernel.IKernelConnection) {
        // We are the session.

        // Generate a dummy notebook model
        this.model = new NotebookModel();
    }

    public changeKernel(_options: Partial<Kernel.IModel>): Promise<Kernel.IKernelConnection> {
        throw new Error('Method not implemented.');
    }
    public shutdown(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public selectKernel(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public restart(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public setPath(_path: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public setName(_name: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public setType(_type: string): Promise<void> {
        throw new Error('Method not implemented.');
    }

    public addSibling(_widget: Widget, _options?: any): any {
        throw new Error('Method not implemented.');
    }
    public save(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public saveAs(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public revert(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public createCheckpoint(): Promise<import('@jupyterlab/services').Contents.ICheckpointModel> {
        throw new Error('Method not implemented.');
    }
    public deleteCheckpoint(_checkpointID: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public restoreCheckpoint(_checkpointID?: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public listCheckpoints(): Promise<import('@jupyterlab/services').Contents.ICheckpointModel[]> {
        throw new Error('Method not implemented.');
    }
    public dispose(): void {
        throw new Error('Method not implemented.');
    }
}
