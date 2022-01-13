// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { expect } from 'chai';
import { Uri } from 'vscode';
import { IProposedExtensionAPI } from '../client/apiTypes';
import { IConfigurationService, IInterpreterPathService, IPythonSettings } from '../client/common/types';
import { IComponentAdapter } from '../client/interpreter/contracts';
import { IServiceContainer } from '../client/ioc/types';
import { buildProposedApi } from '../client/proposedApi';
import { IDiscoveryAPI } from '../client/pythonEnvironments/base/locator';

suite('Proposed Extension API', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let discoverAPI: typemoq.IMock<IDiscoveryAPI>;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
    let configService: typemoq.IMock<IConfigurationService>;
    let pyenvs: typemoq.IMock<IComponentAdapter>;

    let proposed: IProposedExtensionAPI;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>(undefined, typemoq.MockBehavior.Strict);
        discoverAPI = typemoq.Mock.ofType<IDiscoveryAPI>(undefined, typemoq.MockBehavior.Strict);
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>(undefined, typemoq.MockBehavior.Strict);
        configService = typemoq.Mock.ofType<IConfigurationService>(undefined, typemoq.MockBehavior.Strict);
        pyenvs = typemoq.Mock.ofType<IComponentAdapter>(undefined, typemoq.MockBehavior.Strict);

        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
        serviceContainer.setup((s) => s.get(IConfigurationService)).returns(() => configService.object);
        serviceContainer.setup((s) => s.get(IComponentAdapter)).returns(() => pyenvs.object);

        proposed = buildProposedApi(discoverAPI.object, serviceContainer.object);
    });

    test('getActiveInterpreterPath: No resource', async () => {
        const pythonPath = 'this/is/a/test/path';
        configService
            .setup((c) => c.getSettings(undefined))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = await proposed.environment.getActiveInterpreterPath();
        expect(actual).to.be.equals(pythonPath);
    });
    test('getActiveInterpreterPath: With resource', async () => {
        const resource = Uri.file(__filename);
        const pythonPath = 'this/is/a/test/path';
        configService
            .setup((c) => c.getSettings(resource))
            .returns(() => (({ pythonPath } as unknown) as IPythonSettings));
        const actual = await proposed.environment.getActiveInterpreterPath(resource);
        expect(actual).to.be.equals(pythonPath);
    });

    test('getInterpreterDetails: no discovered python', async () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs.setup((p) => p.getInterpreterDetails(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

        const pythonPath = 'this/is/a/test/path';
        const actual = await proposed.environment.getInterpreterDetails(pythonPath);
        expect(actual).to.be.equal(undefined);
    });

    test('getInterpreterDetails: no discovered python (with cache)', async () => {
        discoverAPI.setup((d) => d.getEnvs()).returns(() => []);
        pyenvs.setup((p) => p.getInterpreterDetails(typemoq.It.isAny())).returns(() => Promise.resolve(undefined));

        const pythonPath = 'this/is/a/test/path';
        const actual = await proposed.environment.getInterpreterDetails(pythonPath, { useCache: true });
        expect(actual).to.be.equal(undefined);
    });
});
