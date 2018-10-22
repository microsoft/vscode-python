// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterManager } from '../../client/linters/linterManager';

// setup class instance
class TestLinterManager extends LinterManager {
    public enableUnconfiguredLintersCallCount: number = 0;

    protected async enableUnconfiguredLinters(resource?: Uri): Promise<boolean> {
        this.enableUnconfiguredLintersCallCount += 1;
        return false;
    }
}

function getServiceContainerMockForLinterManagerTests(): TypeMoq.IMock<IServiceContainer> {
    // setup test mocks
    const serviceContainerMock = TypeMoq.Mock.ofType<IServiceContainer>();
    const configMock = TypeMoq.Mock.ofType<IConfigurationService>();
    const pythonSettingsMock = TypeMoq.Mock.ofType<IPythonSettings>();
    configMock.setup(cm => cm.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettingsMock.object);
    serviceContainerMock.setup(c => c.get(IConfigurationService)).returns(() => configMock.object);

    return serviceContainerMock;
}

// tslint:disable-next-line:max-func-body-length
suite('Lint Manager Unit Tests', () => {

    test('Linter manager isLintingEnabled checks availability when silent = false.', async () => {
        // set expectations
        const expectedCallCount = 1;
        const silentFlag = false;

        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();

        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object);
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
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object);
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
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object);
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
        const lm: TestLinterManager = new TestLinterManager(serviceContainerMock.object);
        await lm.getActiveLinters(silentFlag);

        // test expectations
        expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    });

});
