// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import { IInstaller, IOutputChannel, Product } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { TEST_OUTPUT_CHANNEL } from '../../client/testing/common/constants';
import { TestConfigurationManagerFactory } from '../../client/testing/configurationFactory';
import * as nose from '../../client/testing/nosetest/testConfigurationManager';
import * as pytest from '../../client/testing/pytest/testConfigurationManager';
import { ITestConfigSettingsService, ITestConfigurationManagerFactory } from '../../client/testing/types';
import * as unittest from '../../client/testing/unittest/testConfigurationManager';

use(chaiAsPromised);

suite('Unit Tests - ConfigurationManagerFactory', () => {
    let factory: ITestConfigurationManagerFactory;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const outputChannel = typeMoq.Mock.ofType<OutputChannel>();
        const installer = typeMoq.Mock.ofType<IInstaller>();
        const testConfigService = typeMoq.Mock.ofType<ITestConfigSettingsService>();

        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IOutputChannel), typeMoq.It.isValue(TEST_OUTPUT_CHANNEL))).returns(() => outputChannel.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IInstaller))).returns(() => installer.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(ITestConfigSettingsService))).returns(() => testConfigService.object);
        factory = new TestConfigurationManagerFactory(serviceContainer.object);
    });
    test('Create Unit Test Configuration', async () => {
        const configMgr = factory.create(Uri.file(__filename), Product.unittest);
        expect(configMgr).to.be.instanceOf(unittest.ConfigurationManager);
    });
    test('Create pytest Configuration', async () => {
        const configMgr = factory.create(Uri.file(__filename), Product.pytest);
        expect(configMgr).to.be.instanceOf(pytest.ConfigurationManager);
    });
    test('Create nose Configuration', async () => {
        const configMgr = factory.create(Uri.file(__filename), Product.nosetest);
        expect(configMgr).to.be.instanceOf(nose.ConfigurationManager);
    });
});
