// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterManager } from '../../client/linters/linterManager';

const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();

// setup class instance
class TestLinterManager extends LinterManager {
    public enableUnconfiguredLintersCallCount: number = 0;

    protected async enableUnconfiguredLinters(_resource?: Uri): Promise<void> {
        this.enableUnconfiguredLintersCallCount += 1;
    }
}

function getServiceContainerMockForLinterManagerTests(): TypeMoq.IMock<IServiceContainer> {
    // setup test mocks
    const serviceContainerMock = TypeMoq.Mock.ofType<IServiceContainer>();

    const pythonSettingsMock = TypeMoq.Mock.ofType<IPythonSettings>();
    const configMock = TypeMoq.Mock.ofType<IConfigurationService>();
    configMock.setup((cm) => cm.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettingsMock.object);
    serviceContainerMock.setup((c) => c.get(IConfigurationService)).returns(() => configMock.object);

    const pythonConfig = {
        inspect: () => {},
    };
    workspaceService
        .setup((x) => x.getConfiguration('python', TypeMoq.It.isAny()))

        .returns(() => pythonConfig as any);
    serviceContainerMock.setup((c) => c.get(IWorkspaceService)).returns(() => workspaceService.object);

    return serviceContainerMock;
}

suite('Lint Manager Unit Tests', () => {
    test('Linter manager isLintingEnabled checks availability when silent = false.', async () => {
        // set expectations
        const expectedCallCount = 1;
        const silentFlag = false;

        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();

        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        await lm.isLintingEnabled(silentFlag);

        // test expectations
        expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    });

    test('Linter manager isLintingEnabled does not check availability when silent = true.', async () => {
        // set expectations
        const expectedCallCount = 0;
        const silentFlag = true;

        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();

        // make the call
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        await lm.isLintingEnabled(silentFlag);

        // test expectations
        expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    });

    test('Linter manager getActiveLinters checks availability when silent = false.', async () => {
        // set expectations
        const expectedCallCount = 1;
        const silentFlag = false;

        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();

        // make the call
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        await lm.getActiveLinters(silentFlag);

        // test expectations
        expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    });

    test('Linter manager getActiveLinters checks availability when silent = true.', async () => {
        // set expectations
        const expectedCallCount = 0;
        const silentFlag = true;

        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();

        // make the call
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        await lm.getActiveLinters(silentFlag);

        // test expectations
        expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    });
});
