// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import { PYTHON_LANGUAGE } from '../../../common/constants';
import { IFileSystem } from '../../../common/platform/types';
import * as localize from '../../../common/utils/localize';
import { IInterpreterSelector } from '../../../interpreter/configuration/types';
import { IJupyterKernel, IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelService } from './kernelService';
import { IKernelSelectionListProvider, IKernelSpecQuickPickItem } from './types';

// Small classes, hence all put into one file.
// tslint:disable: max-classes-per-file

/**
 * Given a kernel spec, this will return a quick pick item with appropriate display names and the like.
 *
 * @param {IJupyterKernelSpec} kernelSpec
 * @returns {IKernelSpecQuickPickItem}
 */
function getQuickPickItemForKernelSpec(kernelSpec: IJupyterKernelSpec): IKernelSpecQuickPickItem {
    return {
        label: kernelSpec.display_name,
        description: localize.DataScience.kernelDescriptionForKernelPicker(),
        selection: { kernelModel: undefined, kernelSpec: kernelSpec, interpreter: undefined }
    };
}

/**
 * Given an active kernel, this will return a quick pick item with appropriate display names and the like.
 *
 * @param {(IJupyterKernel & Partial<IJupyterKernelSpec>)} kernel
 * @returns {IKernelSpecQuickPickItem}
 */
function getQuickPickItemForActiveKernel(kernel: IJupyterKernel & Partial<IJupyterKernelSpec>): IKernelSpecQuickPickItem {
    return {
        label: kernel.display_name || kernel.name || '',
        description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(kernel.lastActivityTime.toLocaleString(), kernel.numberOfConnections.toString()),
        selection: { kernelModel: kernel, kernelSpec: undefined, interpreter: undefined }
    };
}

/**
 * Provider for active kernel specs in a jupyter session.
 *
 * @export
 * @class ActiveJupyterSessionKernelSelectionListProvider
 * @implements {IKernelSelectionListProvider}
 */
export class ActiveJupyterSessionKernelSelectionListProvider implements IKernelSelectionListProvider {
    constructor(private readonly sessionManager: IJupyterSessionManager) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const [activeKernels, kernelSpecs] = await Promise.all([this.sessionManager.getRunningKernels(), this.sessionManager.getKernelSpecs()]);
        const items = activeKernels.map(item => {
            const matchingSpec: Partial<IJupyterKernelSpec> = kernelSpecs.find(spec => spec.name === item.name) || {};
            return {
                ...item,
                ...matchingSpec
            };
        });
        return items
            .filter(item => item.display_name || item.name)
            .filter(item => (item.language || '').toLowerCase() === PYTHON_LANGUAGE.toLowerCase())
            .map(getQuickPickItemForActiveKernel);
    }
}

/**
 * Provider for installed kernel specs (`python -m jupyter kernelspec list`).
 *
 * @export
 * @class InstalledJupyterKernelSelectionListProvider
 * @implements {IKernelSelectionListProvider}
 */
export class InstalledJupyterKernelSelectionListProvider implements IKernelSelectionListProvider {
    constructor(private readonly kernelService: KernelService, private readonly sessionManager?: IJupyterSessionManager) {}
    public async getKernelSelections(cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.kernelService.getKernelSpecs(this.sessionManager, cancelToken);
        return items
            .filter(item => (item.language || '').toLowerCase() === PYTHON_LANGUAGE.toLowerCase())
            .map(getQuickPickItemForKernelSpec);
    }
}

/**
 * Provider for interpreters to be treated as kernel specs.
 * I.e. return interpreters that are to be treated as kernel specs, and not yet installed as kernels.
 *
 * @export
 * @class InterpreterKernelSelectionListProvider
 * @implements {IKernelSelectionListProvider}
 */
export class InterpreterKernelSelectionListProvider implements IKernelSelectionListProvider {
    constructor(private readonly interpreterSelector: IInterpreterSelector) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.interpreterSelector.getSuggestions(undefined);
        return items.map(item => {
            return {
                ...item,
                selection: { kernelModel: undefined, interpreter: item.interpreter, kernelSpec: undefined }
            };
        });
    }
}

/**
 * Provides a list of kernel specs for selection, for both local and remote sessions.
 *
 * @export
 * @class KernelSelectionProviderFactory
 */
@injectable()
export class KernelSelectionProvider {
    constructor(
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem) {}
    /**
     * Gets a selection of kernel specs from a remote session.
     *
     * @param {IJupyterSessionManager} sessionManager
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSpecQuickPickItem[]>}
     * @memberof KernelSelectionProvider
     */
    public async getKernelSelectionsForRemoteSession(sessionManager: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        return new ActiveJupyterSessionKernelSelectionListProvider(sessionManager).getKernelSelections(cancelToken);
    }
    /**
     * Gets a selection of kernel specs for a local session.
     *
     * @param {IJupyterSessionManager} [sessionManager]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSelectionListProvider>}
     * @memberof KernelSelectionProvider
     */
    public async getKernelSelectionsForLocalSession(sessionManager?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        const installedKernelsPromise = new InstalledJupyterKernelSelectionListProvider(this.kernelService, sessionManager).getKernelSelections(cancelToken);
        const interpretersPromise = new InterpreterKernelSelectionListProvider(this.interpreterSelector).getKernelSelections(cancelToken);

        // tslint:disable-next-line: prefer-const
        let [installedKernels, interpreters] = await Promise.all([installedKernelsPromise, interpretersPromise]);

        interpreters = interpreters.filter(item => {
            // If the interpreter is registered as a kernel then don't inlcude it.
            if (installedKernels.find(installedKernel => installedKernel.selection.kernelSpec?.display_name === item.selection.interpreter?.displayName && (
                this.fileSystem.arePathsSame((installedKernel.selection.kernelSpec?.argv || [])[0], item.selection.interpreter?.path || '') ||
                this.fileSystem.arePathsSame(installedKernel.selection.kernelSpec?.metadata?.interpreter?.path || '', item.selection.interpreter?.path || '')))) {
                return false;
            }
            return true;
        }).map(item => {
            // to indicate we're registering/adding these as kernels.
            item.label = `$(plus) ${item.label}`;
            return item;
        });
        // Sorty by name.
        // Do not sort interpreter list, as that's pre-sorted (there's an algorithm for that).
        installedKernels.sort((a, b) => a.label === b.label ? 0 : (a.label > b.label ? 1 : -1));

        return [...installedKernels!, ...interpreters];
    }
}
