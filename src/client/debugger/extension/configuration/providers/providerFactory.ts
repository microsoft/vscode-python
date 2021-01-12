// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { DebugConfigurationType, IDebugConfigurationProvider } from '../../types';
import { IDebugConfigurationProviderFactory } from '../types';

@injectable()
export class DebugConfigurationProviderFactory implements IDebugConfigurationProviderFactory {
    private readonly providers: Map<DebugConfigurationType, IDebugConfigurationProvider>;
    constructor(
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchFastAPI)
        fastapiProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchFlask)
        flaskProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchDjango)
        djangoProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchModule)
        moduleProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchFile)
        fileProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.launchPyramid)
        pyramidProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.remoteAttach)
        remoteAttachProvider: IDebugConfigurationProvider,
        @inject(IDebugConfigurationProvider)
        @named(DebugConfigurationType.pidAttach)
        pidAttachProvider: IDebugConfigurationProvider,
    ) {
        this.providers = new Map<DebugConfigurationType, IDebugConfigurationProvider>();
        this.providers.set(DebugConfigurationType.launchDjango, djangoProvider);
        this.providers.set(DebugConfigurationType.launchFastAPI, fastapiProvider);
        this.providers.set(DebugConfigurationType.launchFlask, flaskProvider);
        this.providers.set(DebugConfigurationType.launchFile, fileProvider);
        this.providers.set(DebugConfigurationType.launchModule, moduleProvider);
        this.providers.set(DebugConfigurationType.launchPyramid, pyramidProvider);
        this.providers.set(DebugConfigurationType.remoteAttach, remoteAttachProvider);
        this.providers.set(DebugConfigurationType.pidAttach, pidAttachProvider);
    }
    public create(configurationType: DebugConfigurationType): IDebugConfigurationProvider {
        return this.providers.get(configurationType)!;
    }
}
