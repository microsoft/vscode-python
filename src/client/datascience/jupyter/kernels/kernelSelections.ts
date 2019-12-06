// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
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
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Localize & fix as per spec.
        description: '(kernel)',
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
        return items.filter(item => item.display_name || item.name).map(getQuickPickItemForActiveKernel);
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
        return items.map(getQuickPickItemForKernelSpec);
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
        // tslint:disable-next-line: no-suspicious-comment
                // TODO: Localize & fix as per spec.
                description: '(register and use interpreter as kernel)',
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
    constructor(@inject(KernelService) private readonly kernelService: KernelService, @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector) {}
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
        const activeKernelsPromise = sessionManager ? new ActiveJupyterSessionKernelSelectionListProvider(sessionManager).getKernelSelections(cancelToken) : Promise.resolve([]);
        const jupyterKernelsPromise = new InstalledJupyterKernelSelectionListProvider(this.kernelService).getKernelSelections(cancelToken);
        const interpretersPromise = new InterpreterKernelSelectionListProvider(this.interpreterSelector).getKernelSelections(cancelToken);
        const [activeKernels, jupyterKernels, interprters] = await Promise.all([activeKernelsPromise, jupyterKernelsPromise, interpretersPromise]);
        return [...jupyterKernels!, ...activeKernels!, ...interprters];
    }
}
