// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { JediLSP } from '../../common/experiments/groups';
import { IDefaultLanguageServer, IExperimentService, IExtensions } from '../../common/types';
import { IServiceManager } from '../../ioc/types';
import { ILSExtensionApi } from '../node/languageServerFolderService';
import { LanguageServerType } from '../types';

export type PotentialDefault = LanguageServerType.Jedi | LanguageServerType.JediLSP | LanguageServerType.Node;

@injectable()
class DefaultLanguageServer implements IDefaultLanguageServer {
    public readonly defaultLSType: PotentialDefault;

    constructor(defaultServer: PotentialDefault) {
        this.defaultLSType = defaultServer;
    }
}

export async function setDefaultLanguageServer(
    experimentService: IExperimentService,
    extensions: IExtensions,
    serviceManager: IServiceManager,
): Promise<void> {
    const lsType = await getDefaultLanguageServer(experimentService, extensions);
    console.log(`Default LS will be ${lsType}`);
    serviceManager.addSingletonInstance<IDefaultLanguageServer>(
        IDefaultLanguageServer,
        new DefaultLanguageServer(lsType),
    );
}

async function getDefaultLanguageServer(
    experimentService: IExperimentService,
    extensions: IExtensions,
): Promise<PotentialDefault> {
    if (extensions.getExtension<ILSExtensionApi>(PYLANCE_EXTENSION_ID)) {
        return LanguageServerType.Node;
    }

    // If Pylance is installed and functional, use it as the default.
    // TODO: This causes a dependency cycle, as VS Code is trying to wait for python to even start pylance...
    // console.log('Activating Pylance');
    // const pylance = await extensions.getExtension<ILSExtensionApi>(PYLANCE_EXTENSION_ID)?.activate();
    // console.log('Activated Pylance');
    // if (pylance && Object.keys(pylance).length !== 0) {
    //     return LanguageServerType.Node;
    // }

    // Otherwise, use jedi.
    return (await experimentService.inExperiment(JediLSP.experiment))
        ? LanguageServerType.JediLSP
        : LanguageServerType.Jedi;
}
