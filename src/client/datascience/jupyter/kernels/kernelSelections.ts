// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import { IInterpreterSelector } from '../../../interpreter/configuration/types';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
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
function getQuickPickFromKernelSpec(kernelSpec: IJupyterKernelSpec): IKernelSpecQuickPickItem {
    return {
        label: kernelSpec.display_name || kernelSpec.name || '',
        description: '',
        selection: { kernelSpec: kernelSpec }
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
    constructor(private readonly session: IJupyterSessionManager) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.session.getActiveKernelSpecs();
        return items.filter(item => item.display_name || item.name).map(getQuickPickFromKernelSpec);
    }
}

/**
 * Provider for kernel specs in a jupyter process (`python -m jupyter kernelspec list`).
 *
 * @export
 * @class JupyterKernelSelectionnListProvider
 * @implements {IKernelSelectionListProvider}
 */
export class JupyterKernelSelectionnListProvider implements IKernelSelectionListProvider {
    constructor(private readonly kernelService: KernelService) {}
    public async getKernelSelections(cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.kernelService.getLocalKernelSpecs(cancelToken);
        return items.filter(item => item.display_name || item.name).map(getQuickPickFromKernelSpec);
    }
}

/**
 * Provider for interpreters to be treated as kernel specs.
 *
 * @export
 * @class InterpreterKernelSelectionnListProvider
 * @implements {IKernelSelectionListProvider}
 */
export class InterpreterKernelSelectionnListProvider implements IKernelSelectionListProvider {
    constructor(private readonly interpreterSelector: IInterpreterSelector) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.interpreterSelector.getSuggestions(undefined);
        return items.map(item => {
            return {
                ...item,
                selection: { interpreter: item.interpreter }
            };
        });
    }
}

/**
 * Factory class that provides a kernel spec list provider (local or remote).
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
     * @param {IJupyterSessionManager} session
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSpecQuickPickItem[]>}
     * @memberof KernelSelectionProvider
     */
    public async getKernelSelectionsForRemoteSession(session: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        return new ActiveJupyterSessionKernelSelectionListProvider(session).getKernelSelections(cancelToken);
    }
    /**
     * Gets a selection of kernel specs for a local session.
     *
     * @param {IJupyterSessionManager} [session]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSelectionListProvider>}
     * @memberof KernelSelectionProvider
     */
    public async getLocalKernelSelectionProvider(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        const activeKernelsPromise = session ? new ActiveJupyterSessionKernelSelectionListProvider(session).getKernelSelections(cancelToken) : Promise.resolve([]);
        const jupyterKernelsPromise = new JupyterKernelSelectionnListProvider(this.kernelService).getKernelSelections(cancelToken);
        const interpretersPromise = new InterpreterKernelSelectionnListProvider(this.interpreterSelector).getKernelSelections(cancelToken);
        const [activeKernels, jupyterKernels, interprters] = await Promise.all([activeKernelsPromise, jupyterKernelsPromise, interpretersPromise]);
        return [...activeKernels!, ...jupyterKernels!, ...interprters];
    }
}
