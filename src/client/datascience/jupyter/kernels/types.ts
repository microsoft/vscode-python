// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { KernelMessage, Session } from '@jupyterlab/services';
import type { Observable } from 'rxjs/Observable';
import type { CancellationToken, Event, QuickPickItem, Uri } from 'vscode';
import type { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import type { IAsyncDisposable, Resource } from '../../../common/types';
import type { PythonInterpreter } from '../../../pythonEnvironments/info';
import type {
    ICell,
    IJupyterKernel,
    IJupyterKernelSpec,
    IJupyterSessionManager,
    InterruptResult,
    KernelSocketInformation
} from '../../types';
import type { KernelSpecInterpreter } from './kernelSelector';

export type LiveKernelModel = IJupyterKernel & Partial<IJupyterKernelSpec> & { session: Session.IModel };

/**
 * Whether a selected kernel is:
 * - Kernel spec (IJupyterKernelSpec)
 * - Active kernel (IJupyterKernel) or
 * - An Interpreter
 */
export type KernelSelection =
    | { kernelModel: LiveKernelModel; kernelSpec: undefined; interpreter: undefined }
    | { kernelModel: undefined; kernelSpec: IJupyterKernelSpec; interpreter: undefined }
    | { kernelModel: undefined; kernelSpec: undefined; interpreter: PythonInterpreter };

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    selection: KernelSelection;
}

export interface IKernelSelectionListProvider {
    getKernelSelections(resource: Resource, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}

export interface IKernelSelectionUsage {
    /**
     * Given a kernel selection, this method will attempt to use that kernel and return the corresponding Interpreter, Kernel Spec and the like.
     * This method will also check if required dependencies are installed or not, and will install them if required.
     */
    useSelectedKernel(
        selection: KernelSelection,
        resource: Resource,
        type: 'raw' | 'jupyter' | 'noConnection',
        session?: IJupyterSessionManager,
        cancelToken?: CancellationToken
    ): Promise<KernelSpecInterpreter | {}>;
}

export interface IKernel extends IAsyncDisposable {
    readonly uri: Uri;
    readonly kernelSpec?: IJupyterKernelSpec | LiveKernelModel;
    readonly metadata: Readonly<KernelSelection>;
    readonly onStatusChanged: Event<ServerStatus>;
    readonly onDisposed: Event<void>;
    readonly onRestarted: Event<void>;
    readonly status: ServerStatus;
    readonly disposed: boolean;
    readonly kernelSocket: Observable<KernelSocketInformation | undefined>;
    start(): Promise<void>;
    interrupt(timeoutInMs: number): Promise<InterruptResult>;
    restart(timeoutInMs: number): Promise<void>;
    executeObservable(code: string, file: string, line: number, id: string, silent: boolean): Observable<ICell[]>;
    registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void;
}

export type KernelOptions = { metadata: KernelSelection; waitForIdleTimeout?: number; launchingFile?: string };
export interface IKernelProvider {
    /**
     * Get hold of the active kernel for a given Uri (Notebook or other file).
     */
    get(uri: Uri): IKernel | undefined;
    /**
     * Gets or creates a kernel for a given Uri.
     * WARNING: If called with different options for same Uri, old kernel associated with the Uri will be disposed.
     */
    getOrCreate(uri: Uri, options: KernelOptions): IKernel | undefined;
}
