// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageClientMiddleware } from '../languageClientMiddleware';

import { LanguageServerType } from '../types';

export class NodeLanguageClientMiddleware extends LanguageClientMiddleware {
    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Node, serverVersion);

        this.setupHidingMiddleware(serviceContainer);
    }

    // eslint-disable-next-line class-methods-use-this
    protected shouldCreateHidingMiddleware(_: IJupyterExtensionDependencyManager): boolean {
        return false;
    }
}
