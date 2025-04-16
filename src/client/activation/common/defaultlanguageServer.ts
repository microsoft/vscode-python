// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { PYLANCE_EXTENSION_ID, PYREFLY_EXTENSION_ID } from '../../common/constants';
import { IDefaultLanguageServer, IExtensions, DefaultLSType } from '../../common/types';
import { IServiceManager } from '../../ioc/types';
import { LanguageServerType } from '../types';

@injectable()
class DefaultLanguageServer implements IDefaultLanguageServer {
    public readonly defaultLSType: DefaultLSType;

    constructor(defaultServer: DefaultLSType) {
        this.defaultLSType = defaultServer;
    }
}

export async function setDefaultLanguageServer(
    extensions: IExtensions,
    serviceManager: IServiceManager,
): Promise<void> {
    const lsType = await getDefaultLanguageServer(extensions);
    serviceManager.addSingletonInstance<IDefaultLanguageServer>(
        IDefaultLanguageServer,
        new DefaultLanguageServer(lsType),
    );
}

async function getDefaultLanguageServer(extensions: IExtensions): Promise<DefaultLSType> {
    let type = LanguageServerType.Jedi;
    if (extensions.getExtension(PYLANCE_EXTENSION_ID)) {
        type =  LanguageServerType.Node;
    }
    
    if (extensions.getExtension(PYREFLY_EXTENSION_ID)) {
        return {type: "none or (if pyrefly language services disabled)", languageServerType: type};
    }
    return {type: "always", languageServerType: type};
}
