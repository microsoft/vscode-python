// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { IConfigurationService, IInstaller, Product } from '../../client/common/types';
import { AvailableLinterActivator } from '../../client/linters/linterAvailability';
import { LinterInfo } from '../../client/linters/linterInfo';
import { IAvailableLinterActivator } from '../../client/linters/types';

// tslint:disable-next-line:max-func-body-length
suite('Linter Availability Provider tests', () => {

    test('Availability feature is disabled when global default for jediEnabled=true.', async () => {
        // set expectations
        const jediEnabledValue = true;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);

        // call
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = availabilityProvider.isFeatureEnabled();

        // check expectaions
        expect(result).is.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Availability feature is enabled when global default for jediEnabled=false.', async () => {
        // set expectations
        const jediEnabledValue = false;
        const expectedResult = true;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);

        const result = availabilityProvider.isFeatureEnabled();

        expect(result).is.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Prompt will be performed when linter is not configured at all for the workspace, workspace-folder, or the user', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = true;

        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(pylintInfo);

        expect(result).to.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the workspace', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = true;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;

        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(pylintInfo);
        expect(result).to.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the entire user', async () => {
        // setup expectations
        const pylintUserValue = true;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;

        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(pylintInfo);
        expect(result).to.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the workspace-folder', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = true;
        const expectedResult = false;

        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(pylintInfo);
        expect(result).to.equal(expectedResult);
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Linter is enabled after being prompted and "Enable <linter>" is selected', async () => {
        // set expectation
        const promptReply = { title: 'Enable pylint', enabled: true };
        const expectedResult = true;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const linterInfo = new class extends LinterInfo {
            public testIsEnabled: boolean = !promptReply.enabled;

            public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
                this.testIsEnabled = enabled;
                return Promise.resolve();
            }

        }(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${linterInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());

        // call
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptToConfigureAvailableLinter(linterInfo);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        expect(linterInfo.testIsEnabled).to.equal(promptReply.enabled, 'LinterInfo test class was not updated as a result of the test.');
    });

    test('Linter is disabled after being prompted and "Disable <linter>" is selected', async () => {
        // set expectation
        const promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const linterInfo = new class extends LinterInfo {
            public testIsEnabled: boolean = !promptReply.enabled;

            public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
                this.testIsEnabled = enabled;
                return Promise.resolve();
            }

        }(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${linterInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());

        // call
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptToConfigureAvailableLinter(linterInfo);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        expect(linterInfo.testIsEnabled).to.equal(promptReply.enabled, 'LinterInfo test class was not updated as a result of the test.');
    });

    test('Linter is left unconfigured after being prompted and the prompt is disabled without any selection made', async () => {
        // set expectation
        const promptReply = undefined;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const linterInfo = new class extends LinterInfo {
            public testIsEnabled: boolean = false;

            public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
                this.testIsEnabled = enabled;
                return Promise.resolve();
            }

        }(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${linterInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());

        // call
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptToConfigureAvailableLinter(linterInfo);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    });

    test('Overall implementation does not change configuration when feature disabled', async () => {
        // set expectations
        const jediEnabledValue = true;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        expect(expectedResult).to.equal(result, 'promptIfLinterAvailable should not change any configuration when python.jediEnabled is true.');
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Overall implementation does not change configuration when linter is configured (enabled)', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = true;
        const pylintWorkspaceFolderEnabled = undefined;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        // perform test
        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is configured in any way.');
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Overall implementation does not change configuration when linter is configured (disabled)', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = true;
        const pylintWorkspaceFolderEnabled = undefined;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        // perform test
        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is disabled in any way.');
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Overall implementation does not change configuration when linter is unavailable in current workspace environment', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = true;
        const pylintWorkspaceFolderEnabled = undefined;
        const linterIsInstalled = false;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is unavailable in the current workspace environment.');
        wkspcConfigSrvcMock.verifyAll();
    });

    test('Overall implementation does not change configuration when user is prompted and prompt is dismissed', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = undefined;
        const pylintWorkspaceFolderEnabled = undefined;
        const linterIsInstalled = true;
        const promptReply = undefined;
        const expectedResult = false;

        // arrange
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${pylintInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            // tslint:disable-next-line:no-any
            .returns(() => promptReply as any)
            .verifiable(TypeMoq.Times.once());
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the user is prompted and they dismiss the prompt.');
        wkspcConfigSrvcMock.verifyAll();
        appShellMock.verifyAll();
        installerMock.verifyAll();
    });

    test('Overall implementation changes configuration when user is prompted and "Disable <linter>" is selected', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = undefined;
        const pylintWorkspaceFolderEnabled = undefined;
        const linterIsInstalled = true;
        const promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;

        // arrange
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${pylintInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the user is prompted and they dismiss the prompt.');
        wkspcConfigSrvcMock.verifyAll();
        appShellMock.verifyAll();
        installerMock.verifyAll();
    });

    test('Overall implementation changes configuration when user is prompted and "Enable <linter>" is selected', async () => {
        // set expectations
        const jediEnabledValue = false;
        const pylintUserEnabled = undefined;
        const pylintWorkspaceEnabled = undefined;
        const pylintWorkspaceFolderEnabled = undefined;
        const linterIsInstalled = true;
        const promptReply = { title: 'Enable pylint', enabled: true };
        const expectedResult = true;

        // arrange
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${pylintInfo.id} is available but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());
        let wkspcConfigSrvcMock = setupWorkspaceServiceForJediSettingTest(jediEnabledValue);
        wkspcConfigSrvcMock = setupWorkspaceMockForLinterConfiguredTests(pylintUserEnabled, pylintWorkspaceEnabled, pylintWorkspaceFolderEnabled, wkspcConfigSrvcMock);

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.promptIfLinterAvailable(pylintInfo);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the user is prompted and they dismiss the prompt.');
        wkspcConfigSrvcMock.verifyAll();
        appShellMock.verifyAll();
        installerMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns true when it succeeds and is present', async () => {
        // set expectations
        const linterIsInstalled = true;
        const expectedResult = true;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.isLinterAvailable(pylintInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns false when it succeeds and is not present', async () => {
        // set expectations
        const linterIsInstalled = false;
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(async () => linterIsInstalled)
            .verifiable(TypeMoq.Times.once());

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.isLinterAvailable(pylintInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns false when it fails', async () => {
        // set expectations
        const expectedResult = false;

        // arrange
        const appShellMock = TypeMoq.Mock.ofType<IApplicationShell>();
        const installerMock = TypeMoq.Mock.ofType<IInstaller>();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
        const wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();

        const pylintInfo = new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        installerMock.setup(im => im.isInstalled(pylintInfo.product, TypeMoq.It.isAny()))
            .returns(() => Promise.reject('error testfail'))
            .verifiable(TypeMoq.Times.once());

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, installerMock.object, wkspcConfigSrvcMock.object);
        const result = await availabilityProvider.isLinterAvailable(pylintInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    });
});

function setupWorkspaceMockForLinterConfiguredTests(
    enabledForUser: boolean | undefined,
    enabeldForWorkspace: boolean | undefined,
    enabledForWorkspaceFolder: boolean | undefined,
    wkspcConfigSrvcMock?: TypeMoq.IMock<IWorkspaceService>): TypeMoq.IMock<IWorkspaceService> {

    if (!wkspcConfigSrvcMock) {
        wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();
    }
    const workspaceConfiguration = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
    workspaceConfiguration.setup(wc => wc.inspect(TypeMoq.It.isValue('pylintEnabled')))
        .returns(() => {
            return {
                key: '',
                globalValue: enabledForUser,
                defaultValue: false,
                workspaceFolderValue: enabeldForWorkspace,
                workspaceValue: enabledForWorkspaceFolder
            };
        })
        .verifiable(TypeMoq.Times.once());

    wkspcConfigSrvcMock.setup(ws => ws.getConfiguration(TypeMoq.It.isValue('python.linting'), TypeMoq.It.isAny()))
        .returns(() => workspaceConfiguration.object)
        .verifiable(TypeMoq.Times.once());

    return wkspcConfigSrvcMock;
}

function setupWorkspaceServiceForJediSettingTest(jediEnabledValue: boolean, wkspcConfigSrvcMock?: TypeMoq.IMock<IWorkspaceService>): TypeMoq.IMock<IWorkspaceService> {

    if (!wkspcConfigSrvcMock) {
        wkspcConfigSrvcMock = TypeMoq.Mock.ofType<IWorkspaceService>();
    }
    const workspaceConfiguration = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
    workspaceConfiguration.setup(wc => wc.inspect(TypeMoq.It.isValue('jediEnabled')))
        .returns(() => {
            return {
                key: '',
                globalValue: undefined,
                defaultValue: jediEnabledValue,
                workspaceFolderValue: undefined,
                workspaceValue: undefined
            };
        })
        .verifiable(TypeMoq.Times.once());
    wkspcConfigSrvcMock.setup(ws => ws.getConfiguration(TypeMoq.It.isValue('python')))
        .returns(() => workspaceConfiguration.object)
        .verifiable(TypeMoq.Times.once());
    return wkspcConfigSrvcMock;
}
