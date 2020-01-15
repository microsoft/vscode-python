// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../../common/application/types';
import { IPersistentState, IPersistentStateFactory } from '../../../common/types';

type CacheInfo = {
    /**
     * Cache store (across VSC sessions).
     *
     * @type {IPersistentState<string | undefined>}
     */
    state: IPersistentState<string | undefined>;
};

@injectable()
export class JupyterInterpreterOldCacheStateStore {
    private readonly workspaceJupyterInterpreter: CacheInfo;
    private readonly globalJupyterInterpreter: CacheInfo;
    constructor(@inject(IWorkspaceService) private readonly workspace: IWorkspaceService, @inject(IPersistentStateFactory) persistentStateFactory: IPersistentStateFactory) {
        // Cache stores to keep track of jupyter interpreters found.
        const workspaceState = persistentStateFactory.createWorkspacePersistentState<string>('DS-VSC-JupyterInterpreter');
        const globalState = persistentStateFactory.createGlobalPersistentState<string>('DS-VSC-JupyterInterpreter');
        this.workspaceJupyterInterpreter = { state: workspaceState };
        this.globalJupyterInterpreter = { state: globalState };
    }
    private get cacheStore(): CacheInfo {
        return this.workspace.hasWorkspaceFolders ? this.workspaceJupyterInterpreter : this.globalJupyterInterpreter;
    }
    public getCachedInterpreterPath(): string | undefined {
        return this.cacheStore.state.value;
    }
    public async clearCache(): Promise<void> {
        await this.cacheStore.state.updateValue(undefined);
    }
}
