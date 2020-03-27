// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import { PYTHON_LANGUAGE } from '../../../common/constants';
import { IFileSystem } from '../../../common/platform/types';
import { IPathUtils, Resource } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { IInterpreterSelector } from '../../../interpreter/configuration/types';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelService } from './kernelService';
import { IKernelSelectionListProvider, IKernelSpecQuickPickItem, LiveKernelModel } from './types';

// Small classes, hence all put into one file.
// tslint:disable: max-classes-per-file

/**
 * Given a kernel spec, this will return a quick pick item with appropriate display names and the like.
 *
 * @param {IJupyterKernelSpec} kernelSpec
 * @returns {IKernelSpecQuickPickItem}
 */
function getQuickPickItemForKernelSpec(
    kernelSpec: IJupyterKernelSpec,
    pathUtils: IPathUtils
): IKernelSpecQuickPickItem {
    return {
        label: kernelSpec.display_name,
        // If we have a matching interpreter, then display that path in the dropdown else path of the kernelspec.
        detail: pathUtils.getDisplayName(kernelSpec.metadata?.interpreter?.path || kernelSpec.path),
        selection: { kernelModel: undefined, kernelSpec: kernelSpec, interpreter: undefined },
    };
}

/**
 * Given an active kernel, this will return a quick pick item with appropriate display names and the like.
 *
 * @param {(LiveKernelModel)} kernel
 * @returns {IKernelSpecQuickPickItem}
 */
function getQuickPickItemForActiveKernel(kernel: LiveKernelModel, pathUtils: IPathUtils): IKernelSpecQuickPickItem {
    const path = kernel.metadata?.interpreter?.path || kernel.path;
    return {
        label: kernel.display_name || kernel.name || '',
        // If we have a matching interpreter, then display that path in the dropdown else path of the kernelspec.
        detail: path ? pathUtils.getDisplayName(path) : '',
        description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
            kernel.lastActivityTime.toLocaleString(),
            kernel.numberOfConnections.toString()
        ),
        selection: { kernelModel: kernel, kernelSpec: undefined, interpreter: undefined },
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
    constructor(private readonly sessionManager: IJupyterSessionManager, private readonly pathUtils: IPathUtils) {}
    public async getKernelSelections(
        _resource: Resource,
        _cancelToken?: CancellationToken | undefined
    ): Promise<IKernelSpecQuickPickItem[]> {
        const [activeKernels, activeSessions, kernelSpecs] = await Promise.all([
            this.sessionManager.getRunningKernels(),
            this.sessionManager.getRunningSessions(),
            this.sessionManager.getKernelSpecs(),
        ]);
        const items = activeSessions.map((item) => {
            const matchingSpec: Partial<IJupyterKernelSpec> =
                kernelSpecs.find((spec) => spec.name === item.kernel.name) || {};
            const activeKernel = activeKernels.find((active) => active.id === item.kernel.id) || {};
            // tslint:disable-next-line: no-object-literal-type-assertion
            return {
                ...item.kernel,
                ...matchingSpec,
                ...activeKernel,
                session: item,
            } as LiveKernelModel;
        });
        return items
            .filter((item) => item.display_name || item.name)
            .filter((item) => 'lastActivityTime' in item && 'numberOfConnections' in item)
            .filter((item) => (item.language || '').toLowerCase() === PYTHON_LANGUAGE.toLowerCase())
            .map((item) => getQuickPickItemForActiveKernel(item, this.pathUtils));
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
    constructor(
        private readonly kernelService: KernelService,
        private readonly pathUtils: IPathUtils,
        private readonly sessionManager?: IJupyterSessionManager
    ) {}
    public async getKernelSelections(
        _resource: Resource,
        cancelToken?: CancellationToken | undefined
    ): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.kernelService.getKernelSpecs(this.sessionManager, cancelToken);
        return items
            .filter((item) => (item.language || '').toLowerCase() === PYTHON_LANGUAGE.toLowerCase())
            .map((item) => getQuickPickItemForKernelSpec(item, this.pathUtils));
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
    public async getKernelSelections(
        resource: Resource,
        _cancelToken?: CancellationToken | undefined
    ): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.interpreterSelector.getSuggestions(resource);
        return items.map((item) => {
            return {
                ...item,
                // We don't want descriptions.
                description: '',
                selection: { kernelModel: undefined, interpreter: item.interpreter, kernelSpec: undefined },
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
    private localSuggestionsCache: IKernelSpecQuickPickItem[] = [];
    private remoteSuggestionsCache: IKernelSpecQuickPickItem[] = [];
    constructor(
        @inject(KernelService) private readonly kernelService: KernelService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {}
    /**
     * Gets a selection of kernel specs from a remote session.
     *
     * @param {IJupyterSessionManager} sessionManager
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSpecQuickPickItem[]>}
     * @memberof KernelSelectionProvider
     */
    public async getKernelSelectionsForRemoteSession(
        resource: Resource,
        sessionManager: IJupyterSessionManager,
        cancelToken?: CancellationToken
    ): Promise<IKernelSpecQuickPickItem[]> {
        const getSelections = async () => {
            const installedKernelsPromise = new InstalledJupyterKernelSelectionListProvider(
                this.kernelService,
                this.pathUtils,
                sessionManager
            ).getKernelSelections(resource, cancelToken);
            const liveKernelsPromise = new ActiveJupyterSessionKernelSelectionListProvider(
                sessionManager,
                this.pathUtils
            ).getKernelSelections(resource, cancelToken);
            const [installedKernels, liveKernels] = await Promise.all([installedKernelsPromise, liveKernelsPromise]);

            // Sorty by name.
            installedKernels.sort((a, b) => (a.label === b.label ? 0 : a.label > b.label ? 1 : -1));
            liveKernels.sort((a, b) => (a.label === b.label ? 0 : a.label > b.label ? 1 : -1));
            return [...liveKernels!, ...installedKernels!];
        };

        const liveItems = getSelections().then((items) => (this.localSuggestionsCache = items));
        // If we have someting in cache, return that, while fetching in the background.
        const cachedItems =
            this.remoteSuggestionsCache.length > 0 ? Promise.resolve(this.remoteSuggestionsCache) : liveItems;
        return Promise.race([cachedItems, liveItems]);
    }
    /**
     * Gets a selection of kernel specs for a local session.
     *
     * @param {IJupyterSessionManager} [sessionManager]
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IKernelSelectionListProvider>}
     * @memberof KernelSelectionProvider
     */
    public async getKernelSelectionsForLocalSession(
        resource: Resource,
        sessionManager?: IJupyterSessionManager,
        cancelToken?: CancellationToken
    ): Promise<IKernelSpecQuickPickItem[]> {
        const getSelections = async () => {
            const installedKernelsPromise = new InstalledJupyterKernelSelectionListProvider(
                this.kernelService,
                this.pathUtils,
                sessionManager
            ).getKernelSelections(resource, cancelToken);
            const interpretersPromise = new InterpreterKernelSelectionListProvider(
                this.interpreterSelector
            ).getKernelSelections(resource, cancelToken);

            // tslint:disable-next-line: prefer-const
            let [installedKernels, interpreters] = await Promise.all([installedKernelsPromise, interpretersPromise]);

            interpreters = interpreters
                .filter((item) => {
                    // If the interpreter is registered as a kernel then don't inlcude it.
                    if (
                        installedKernels.find(
                            (installedKernel) =>
                                installedKernel.selection.kernelSpec?.display_name ===
                                    item.selection.interpreter?.displayName &&
                                (this.fileSystem.arePathsSame(
                                    (installedKernel.selection.kernelSpec?.argv || [])[0],
                                    item.selection.interpreter?.path || ''
                                ) ||
                                    this.fileSystem.arePathsSame(
                                        installedKernel.selection.kernelSpec?.metadata?.interpreter?.path || '',
                                        item.selection.interpreter?.path || ''
                                    ))
                        )
                    ) {
                        return false;
                    }
                    return true;
                })
                .map((item) => {
                    // We don't want descriptions.
                    return { ...item, description: '' };
                });

            const unifiedList = [...installedKernels!, ...interpreters];
            // Sorty by name.
            unifiedList.sort((a, b) => (a.label === b.label ? 0 : a.label > b.label ? 1 : -1));

            return unifiedList;
        };

        const liveItems = getSelections().then((items) => (this.localSuggestionsCache = items));
        // If we have someting in cache, return that, while fetching in the background.
        const cachedItems =
            this.localSuggestionsCache.length > 0 ? Promise.resolve(this.localSuggestionsCache) : liveItems;
        return Promise.race([cachedItems, liveItems]);
    }
}
