// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import {
    IApplicationShell, IWorkspaceService
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import {
    IConfigurationService, IPythonSettings, Product
} from '../../client/common/types';
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
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);

        // call
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        // check expectaions
        expect(availabilityProvider.isFeatureEnabled).is.equal(expectedResult, 'Avaialability feature should be disabled when python.jediEnabled is true');
        workspaceServiceMock.verifyAll();
    });

    test('Availability feature is enabled when global default for jediEnabled=false.', async () => {
        // set expectations
        const jediEnabledValue = false;
        const expectedResult = true;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        expect(availabilityProvider.isFeatureEnabled).is.equal(expectedResult, 'Avaialability feature should be enabled when python.jediEnabled defaults to false');
        workspaceServiceMock.verifyAll();
    });

    test('Prompt will be performed when linter is not configured at all for the workspace, workspace-folder, or the user', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = true;

        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);

        expect(result).to.equal(expectedResult, 'Linter is unconfigured but prompt did not get raised');
        workspaceServiceMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the workspace', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = true;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;

        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);

        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for workspace.');
        workspaceServiceMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the entire user', async () => {
        // setup expectations
        const pylintUserValue = true;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for user.');
        workspaceServiceMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the workspace-folder', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = true;
        const expectedResult = false;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for workspace-folder.');
        workspaceServiceMock.verifyAll();
    });

    async function testForLinterPromptResponse(promptReply: { title: string; enabled: boolean } | undefined): Promise<boolean> {
        // arrange
        const [appShellMock, fsMock, workspaceServiceMock] = getDependenciesForAvailabilityTests();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const linterInfo = new class extends LinterInfo {
            public testIsEnabled: boolean = promptReply ? promptReply.enabled : false;

            public async enableAsync(enabled: boolean, _resource?: Uri): Promise<void> {
                this.testIsEnabled = enabled;
                return Promise.resolve();
            }

        }(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${linterInfo.id} is installed but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply as any;
            })
            .verifiable(TypeMoq.Times.once());

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = await availabilityProvider.promptToConfigureAvailableLinter(linterInfo);
        if (promptReply) {
            expect(linterInfo.testIsEnabled).to.equal(promptReply.enabled, 'LinterInfo test class was not updated as a result of the test.');
        }

        return result;
    }

    test('Linter is enabled after being prompted and "Enable <linter>" is selected', async () => {
        // set expectations
        const expectedResult = true;
        const promptReply = { title: 'Enable pylint', enabled: true };

        // run scenario
        const result = await testForLinterPromptResponse(promptReply);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    });

    test('Linter is disabled after being prompted and "Disable <linter>" is selected', async () => {
        // set expectation
        const promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;

        // run scenario
        const result = await testForLinterPromptResponse(promptReply);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    });

    test('Linter is left unconfigured after being prompted and the prompt is disabled without any selection made', async () => {
        // set expectation
        const promptReply = undefined;
        const expectedResult = false;

        // run scenario
        const result = await testForLinterPromptResponse(promptReply);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    });

    // Options to test the implementation of the IAvailableLinterActivator.
    // All options default to values that would otherwise allow the prompt to appear.
    class AvailablityTestOverallOptions {
        public jediEnabledValue: boolean = false;
        public pylintUserEnabled?: boolean;
        public pylintWorkspaceEnabled?: boolean;
        public pylintWorkspaceFolderEnabled?: boolean;
        public linterIsInstalled: boolean = true;
        public promptReply?: { title: string; enabled: boolean };
    }

    async function performTestOfOverallImplementation(options: AvailablityTestOverallOptions): Promise<boolean> {
        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        appShellMock.setup(ap => ap.showInformationMessage(
            TypeMoq.It.isValue(`Linter ${linterInfo.id} is installed but not enabled.`),
            TypeMoq.It.isAny(),
            TypeMoq.It.isAny())
        )
            // tslint:disable-next-line:no-any
            .returns(() => options.promptReply as any)
            .verifiable(TypeMoq.Times.once());

        const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
        workspaceServiceMock
            .setup(c => c.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceServiceMock
            .setup(c => c.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fsMock.setup(fs => fs.fileExists(TypeMoq.It.isAny()))
            .returns(async () => options.linterIsInstalled)
            .verifiable(TypeMoq.Times.once());

        setupConfigurationServiceForJediSettingsTest(options.jediEnabledValue, configServiceMock);
        setupWorkspaceMockForLinterConfiguredTests(
            options.pylintUserEnabled,
            options.pylintWorkspaceEnabled,
            options.pylintWorkspaceFolderEnabled,
            workspaceServiceMock
        );

        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);
        return availabilityProvider.promptIfLinterAvailable(linterInfo);
    }

    test('Overall implementation does not change configuration when feature disabled', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.jediEnabledValue = true;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        // perform test
        expect(expectedResult).to.equal(result, 'promptIfLinterAvailable should not change any configuration when python.jediEnabled is true.');
    });

    test('Overall implementation does not change configuration when linter is configured (enabled)', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        // perform test
        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is configured in any way.');
    });

    test('Overall implementation does not change configuration when linter is configured (disabled)', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = false;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is disabled in any way.');
    });

    test('Overall implementation does not change configuration when linter is unavailable in current workspace environment', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is unavailable in the current workspace environment.');
    });

    test('Overall implementation does not change configuration when user is prompted and prompt is dismissed', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = undefined; // just being explicit for test readability - this is the default
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(result, 'Configuration should not change if the user is prompted and they dismiss the prompt.');
    });

    test('Overall implementation changes configuration when user is prompted and "Disable <linter>" is selected', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(result, 'Configuration should change if the user is prompted and they choose to update the linter config.');
    });

    test('Overall implementation changes configuration when user is prompted and "Enable <linter>" is selected', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = { title: 'Enable pylint', enabled: true };
        const expectedResult = true;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(result, 'Configuration should change if the user is prompted and they choose to update the linter config.');
    });

    test('Discovery of linter is available in the environment returns true when it succeeds and is present', async () => {
        // set expectations
        const linterIsInstalled = true;
        const expectedResult = true;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, fsMock, workspaceServiceMock);

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = await availabilityProvider.isLinterAvailable(linterInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        fsMock.verifyAll();
        workspaceServiceMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns false when it succeeds and is not present', async () => {
        // set expectations
        const linterIsInstalled = false;
        const expectedResult = false;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, fsMock, workspaceServiceMock);

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = await availabilityProvider.isLinterAvailable(linterInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        fsMock.verifyAll();
        workspaceServiceMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns false when it fails', async () => {
        // set expectations
        const expectedResult = false;

        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
        workspaceServiceMock
            .setup(c => c.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceServiceMock
            .setup(c => c.workspaceFolders)
            .returns(() => [workspaceFolder]);
        workspaceServiceMock
            .setup(c => c.getWorkspaceFolder(TypeMoq.It.isAny()))
            .returns(() => workspaceFolder);
        fsMock.setup(fs => fs.fileExists(TypeMoq.It.isAny()))
            .returns(async () => Promise.reject('error testfail'))
            .verifiable(TypeMoq.Times.once());

        // perform test
        const availabilityProvider = new AvailableLinterActivator(appShellMock.object, fsMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = await availabilityProvider.isLinterAvailable(linterInfo.product);

        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        fsMock.verifyAll();
        workspaceServiceMock.verifyAll();
    });
});

function setupWorkspaceMockForLinterConfiguredTests(
    enabledForUser: boolean | undefined,
    enabeldForWorkspace: boolean | undefined,
    enabledForWorkspaceFolder: boolean | undefined,
    workspaceServiceMock?: TypeMoq.IMock<IWorkspaceService>): TypeMoq.IMock<IWorkspaceService> {

    if (!workspaceServiceMock) {
        workspaceServiceMock = TypeMoq.Mock.ofType<IWorkspaceService>();
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

    workspaceServiceMock.setup(ws => ws.getConfiguration(TypeMoq.It.isValue('python.linting'), TypeMoq.It.isAny()))
        .returns(() => workspaceConfiguration.object)
        .verifiable(TypeMoq.Times.once());

    return workspaceServiceMock;
}

function setupConfigurationServiceForJediSettingsTest(
    jediEnabledValue: boolean,
    configServiceMock: TypeMoq.IMock<IConfigurationService>
): [
        TypeMoq.IMock<IConfigurationService>,
        TypeMoq.IMock<IPythonSettings>
    ] {

    if (!configServiceMock) {
        configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
    }
    const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
    pythonSettings.setup(ps => ps.jediEnabled).returns(() => jediEnabledValue);

    configServiceMock.setup(cs => cs.getSettings()).returns(() => pythonSettings.object);
    return [configServiceMock, pythonSettings];
}

function setupInstallerForAvailabilityTest(_linterInfo: LinterInfo, linterIsInstalled: boolean, fsMock: TypeMoq.IMock<IFileSystem>, workspaceServiceMock: TypeMoq.IMock<IWorkspaceService>): TypeMoq.IMock<IFileSystem> {
    if (!fsMock) {
        fsMock = TypeMoq.Mock.ofType<IFileSystem>();
    }
    const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
    workspaceServiceMock
        .setup(c => c.hasWorkspaceFolders)
        .returns(() => true)
        .verifiable(TypeMoq.Times.once());
    workspaceServiceMock
        .setup(c => c.workspaceFolders)
        .returns(() => [workspaceFolder]);
    workspaceServiceMock
        .setup(c => c.getWorkspaceFolder(TypeMoq.It.isAny()))
        .returns(() => workspaceFolder);
    fsMock.setup(fs => fs.fileExists(TypeMoq.It.isAny()))
        .returns(async () => linterIsInstalled)
        .verifiable(TypeMoq.Times.once());

    return fsMock;
}

function getDependenciesForAvailabilityTests(): [
    TypeMoq.IMock<IApplicationShell>,
    TypeMoq.IMock<IFileSystem>,
    TypeMoq.IMock<IWorkspaceService>,
    TypeMoq.IMock<IConfigurationService>,
    LinterInfo
] {
    const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
    return [
        TypeMoq.Mock.ofType<IApplicationShell>(),
        TypeMoq.Mock.ofType<IFileSystem>(),
        TypeMoq.Mock.ofType<IWorkspaceService>(),
        TypeMoq.Mock.ofType<IConfigurationService>(),
        new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc'])
    ];
}
