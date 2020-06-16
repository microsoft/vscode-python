// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export type Progress = { action: ReportableAction; phase: 'started' | 'completed' };
export interface IProgressReporter {
    report(progress: Progress): void;
}

/**
 * Actions performed by extension that can be (potentially) reported to the user.
 *
 * @export
 * @enum {number}
 */
export enum ReportableAction {
    /**
     * Getting kernels for a local connection.
     * If not found, user may have to select or we might register a kernel.
     */
    KernelsGetKernelForLocalConnection = 'KernelsStartGetKernelForLocalConnection',
    /**
     * Getting kernels for a remote connection.
     * If not found, user may have to select.
     */
    KernelsGetKernelForRemoteConnection = 'KernelsGetKernelForRemoteConnection',
    /**
     * Registering kernel.
     */
    KernelsRegisterKernel = 'KernelsRegisterKernel',
    /**
     * Retrieving kernel specs.
     */
    KernelsGetKernelSpecs = 'KernelsGetKernelSpecs',
    /**
     * Starting Jupyter Notebook & waiting to get connection information.
     */
    NotebookStart = 'NotebookStart',
    /**
     * Connecting to the Jupyter Notebook.
     */
    NotebookConnect = 'NotebookConnect',
    /**
     * Wait for session to go idle.
     */
    JupyterSessionWaitForIdleSession = 'JupyterSessionWaitForIdleSession',
    /**
     * Connecting a raw kernel session
     */
    RawKernelConnecting = 'RawKernelConnecting',
    CheckingIfImportIsSupported = 'CheckingIfImportIsSupported',
    InstallingMissingDependencies = 'InstallingMissingDependencies',
    ExportNotebookToPython = 'ExportNotebookToPython'
}
