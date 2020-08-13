// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { KernelMessage, Session } from '@jupyterlab/services';
import type { Observable } from 'rxjs/Observable';
import type { CancellationToken, Event, QuickPickItem, Uri } from 'vscode';
import { NotebookCell, NotebookDocument } from '../../../../../types/vscode-proposed';
import type { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import type { IAsyncDisposable, Resource } from '../../../common/types';
import type { PythonInterpreter } from '../../../pythonEnvironments/info';
import type {
    IJupyterKernel,
    IJupyterKernelSpec,
    IJupyterSessionManager,
    InterruptResult,
    KernelSocketInformation
} from '../../types';
import type { KernelSpecInterpreter } from './kernelSelector';

export type LiveKernelModel = IJupyterKernel & Partial<IJupyterKernelSpec> & { session: Session.IModel };

/**
 * Connection metadata for Live Kernels.
 * With this we are able connect to an existing kernel (instead of starting a new session).
 */
export type LiveKernelConnectionMetadata = {
    kernelModel: LiveKernelModel;
    kernelSpec: undefined;
    interpreter: undefined;
    kind: 'live';
};
/**
 * Connection metadata for Kernels started using kernelspec (JSON).
 * This could be a raw kernel (spec might have path to executable for .NET or the like).
 */
export type KernelSpecConnectionMetadata = {
    kernelModel: undefined;
    kernelSpec: IJupyterKernelSpec;
    interpreter: undefined;
    kind: 'kernelSpec';
};
/**
 * Connection metadata for Kernels started using Python interpreter.
 * These are not necessarily raw (it could be plain old Jupyter Kernels, where we register Python interpreter as a kernel)
 */
export type PythonKernelConnectionMetadata = {
    kernelModel: undefined;
    kernelSpec: undefined;
    interpreter: PythonInterpreter;
    kind: 'pythonInterpreter';
};
// /**
//  * Connection metadata for Kernels started using Python interpreter with Kernel spec (JSON).
//  * Sometimes, we're unable to determine the exact interpreter associated with a kernelspec, in such cases this is a closes match.
//  */

// export type PythonKernelSpecConnectionMetadata = {
//     kernelModel: undefined;
//     kernelSpec: IJupyterKernelSpec;
//     interpreter: PythonInterpreter;
//     kind: 'pythonInterpreterKernelSpec';
// };
// /**
//  * Connection metadata for Kernels started using kernelspec (JSON).
//  * Note, we could be connecting/staring a kernel on a remote jupyter server.
//  * Sometimes, we're unable to determine the exact interpreter associated with a kernelspec, in such cases this is a closes match.
//  * E.g. when selecting a remote kernel, we do not have the remote interpreter information, we can only try to find a close match.}
//  */

// export type PythonLiveKernelConnectionMetadata = {
//     kernelModel: undefined;
//     kernelSpec: IJupyterKernelSpec;
//     interpreter: PythonInterpreter;
//     kind: 'pythonInterpreterLive';
// };
export type KernelSelection =
    | LiveKernelConnectionMetadata
    | KernelSpecConnectionMetadata
    | PythonKernelConnectionMetadata;
// | PythonKernelSpecConnectionMetadata
// | PythonLiveKernelConnectionMetadata;

export interface IKernelSpecQuickPickItem<T extends KernelSelection = KernelSelection> extends QuickPickItem {
    selection: T;
}
export interface IKernelSelectionListProvider<T extends KernelSelection = KernelSelection> {
    getKernelSelections(resource: Resource, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem<T>[]>;
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
    interrupt(): Promise<InterruptResult>;
    restart(): Promise<void>;
    executeCell(cell: NotebookCell): Promise<void>;
    executeAllCells(document: NotebookDocument): Promise<void>;
    registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void;
}

export type KernelOptions = { metadata: KernelSelection; waitForIdleTimeout?: number; launchingFile?: string };
export const IKernelProvider = Symbol('IKernelProvider');
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
