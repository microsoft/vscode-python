// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { getNamesAndValues } from '../../../../../client/common/utils/enum';
import { DebugConfigurationProviderFactory } from '../../../../../client/debugger/extension/configuration/providers/providerFactory';
import { IDebugConfigurationProviderFactory } from '../../../../../client/debugger/extension/configuration/types';
import { DebugConfigurationType, IDebugConfigurationProvider } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider Factory', () => {
    let mappedProviders: Map<DebugConfigurationType, IDebugConfigurationProvider>;
    let factory: IDebugConfigurationProviderFactory;
    setup(() => {
        mappedProviders = new Map<DebugConfigurationType, IDebugConfigurationProvider>();
        getNamesAndValues<DebugConfigurationType>(DebugConfigurationType).forEach((item) => {
            mappedProviders.set(item.value, (item.value as any) as IDebugConfigurationProvider);
        });
        factory = new DebugConfigurationProviderFactory(
            mappedProviders.get(DebugConfigurationType.launchFastAPI)!,
            mappedProviders.get(DebugConfigurationType.launchFlask)!,
            mappedProviders.get(DebugConfigurationType.launchDjango)!,
            mappedProviders.get(DebugConfigurationType.launchModule)!,
            mappedProviders.get(DebugConfigurationType.launchFile)!,
            mappedProviders.get(DebugConfigurationType.launchPyramid)!,
            mappedProviders.get(DebugConfigurationType.remoteAttach)!,
            mappedProviders.get(DebugConfigurationType.pidAttach)!,
        );
    });
    getNamesAndValues<DebugConfigurationType>(DebugConfigurationType).forEach((item) => {
        test(`Configuration Provider for ${item.name}`, () => {
            const provider = factory.create(item.value);
            expect(provider).to.equal(mappedProviders.get(item.value));
        });
    });
});
