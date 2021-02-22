// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { LanguageServerType } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { IDefaultLanguageServer, IExperimentService } from '../types';
import { DiscoveryVariants, JediLSP } from './groups';

export async function inDiscoveryExperiment(experimentService: IExperimentService): Promise<boolean> {
    const results = await Promise.all([
        experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching),
        experimentService.inExperiment(DiscoveryVariants.discoveryWithoutFileWatching),
    ]);
    return results.includes(true);
}

@injectable()
class DefaultLanguageServer implements IDefaultLanguageServer {
    public readonly defaultLSType: LanguageServerType.Jedi | LanguageServerType.JediLSP;

    constructor(defaultServer: LanguageServerType.Jedi | LanguageServerType.JediLSP) {
        this.defaultLSType = defaultServer;
    }
}

export async function setDefaultLanguageServerByExperiment(
    experimentService: IExperimentService,
    workspaceService: IWorkspaceService,
    serviceManager: IServiceManager,
): Promise<void> {
    const settings = workspaceService.getConfiguration('python');
    const lsSetting = settings.inspect('languageServer');
    if (lsSetting) {
        if (
            lsSetting.globalValue ||
            lsSetting.globalLanguageValue ||
            lsSetting.workspaceFolderValue ||
            lsSetting.workspaceFolderLanguageValue ||
            lsSetting.workspaceValue ||
            lsSetting.workspaceLanguageValue
        ) {
            return Promise.resolve();
        }
    }
    const lsType = (await experimentService.inExperiment(JediLSP.experiment))
        ? LanguageServerType.JediLSP
        : LanguageServerType.Jedi;
    serviceManager.addSingletonInstance<IDefaultLanguageServer>(
        IDefaultLanguageServer,
        new DefaultLanguageServer(lsType),
    );
    return Promise.resolve();
}
