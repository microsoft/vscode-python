// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { IConfigurationService } from '../client/common/types';
import { IComponentAdapter, IInterpreterService } from '../client/interpreter/contracts';
import { IServiceContainer } from '../client/ioc/types';
import { IDiscoveryAPI } from '../client/pythonEnvironments/base/locator';

suite('Proposed Extension API', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let discoverAPI: typemoq.IMock<IDiscoveryAPI>;
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let configService: typemoq.IMock<IConfigurationService>;
    let pyenvs: typemoq.IMock<IComponentAdapter>;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>(undefined, typemoq.MockBehavior.Strict);
        discoverAPI = typemoq.Mock.ofType<IDiscoveryAPI>(undefined, typemoq.MockBehavior.Strict);
        interpreterService = typemoq.Mock.ofType<IInterpreterService>(undefined, typemoq.MockBehavior.Strict);
        configService = typemoq.Mock.ofType<IConfigurationService>(undefined, typemoq.MockBehavior.Strict);
        pyenvs = typemoq.Mock.ofType<IComponentAdapter>(undefined, typemoq.MockBehavior.Strict);

        serviceContainer.setup((s) => s.get(IInterpreterService)).returns(() => interpreterService.object);
        serviceContainer.setup((s) => s.get(IConfigurationService)).returns(() => configService.object);
        serviceContainer.setup((s) => s.get(IComponentAdapter)).returns(() => pyenvs.object);
    });
});
