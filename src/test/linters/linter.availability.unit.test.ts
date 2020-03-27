// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import {
    IConfigurationService,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
    Product
} from '../../client/common/types';
import { Common, Linters } from '../../client/common/utils/localize';
import { AvailableLinterActivator } from '../../client/linters/linterAvailability';
import { LinterInfo } from '../../client/linters/linterInfo';
import { IAvailableLinterActivator, ILinterInfo } from '../../client/linters/types';

// tslint:disable:max-func-body-length no-any
suite('Linter Availability Provider tests', () => {
    test('Availability feature is disabled when global default for jediEnabled=true.', async () => {
        // set expectations
        const jediEnabledValue = true;
        const expectedResult = false;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock
        ] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);

        // call
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

        // check expectaions
        expect(availabilityProvider.isFeatureEnabled).is.equal(
            expectedResult,
            'Avaialability feature should be disabled when python.jediEnabled is true'
        );
        workspaceServiceMock.verifyAll();
    });

    test('Availability feature is enabled when global default for jediEnabled=false.', async () => {
        // set expectations
        const jediEnabledValue = false;
        const expectedResult = true;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock
        ] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);

        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

        expect(availabilityProvider.isFeatureEnabled).is.equal(
            expectedResult,
            'Avaialability feature should be enabled when python.jediEnabled defaults to false'
        );
        workspaceServiceMock.verifyAll();
    });

    test('Prompt will be performed when linter is not configured at all for the workspace, workspace-folder, or the user', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = true;

        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(
            pylintUserValue,
            pylintWorkspaceValue,
            pylintWorkspaceFolderValue,
            workspaceServiceMock
        );

        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

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

        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(
            pylintUserValue,
            pylintWorkspaceValue,
            pylintWorkspaceFolderValue,
            workspaceServiceMock
        );

        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(
            expectedResult,
            'Available linter prompt should not be shown when linter is configured for workspace.'
        );
        workspaceServiceMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the entire user', async () => {
        // setup expectations
        const pylintUserValue = true;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(
            pylintUserValue,
            pylintWorkspaceValue,
            pylintWorkspaceFolderValue,
            workspaceServiceMock
        );
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(
            expectedResult,
            'Available linter prompt should not be shown when linter is configured for user.'
        );
        workspaceServiceMock.verifyAll();
    });

    test('No prompt performed when linter is configured as enabled for the workspace-folder', async () => {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = true;
        const expectedResult = false;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(
            pylintUserValue,
            pylintWorkspaceValue,
            pylintWorkspaceFolderValue,
            workspaceServiceMock
        );
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );

        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        expect(result).to.equal(
            expectedResult,
            'Available linter prompt should not be shown when linter is configured for workspace-folder.'
        );
        workspaceServiceMock.verifyAll();
    });

    async function testForLinterPromptResponse(
        promptAction: 'enable' | 'ignore' | 'disablePrompt' | undefined,
        promptEnabled = true
    ): Promise<boolean> {
        // arrange
        const [appShellMock, fsMock, workspaceServiceMock, , factoryMock] = getDependenciesForAvailabilityTests();
        const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();

        const linterInfo = new (class extends LinterInfo {
            public testIsEnabled: boolean = promptAction === 'enable' ? true : false;

            public async enableAsync(enabled: boolean, _resource?: Uri): Promise<void> {
                this.testIsEnabled = enabled;
                return Promise.resolve();
            }
        })(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);

        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        factoryMock
            .setup((f) => f.createWorkspacePersistentState(TypeMoq.It.isAny(), true))
            .returns(() => notificationPromptEnabled.object);
        notificationPromptEnabled.setup((n) => n.value).returns(() => promptEnabled);
        const selections: ['enable', 'ignore', 'disablePrompt'] = ['enable', 'ignore', 'disablePrompt'];
        const optButtons = [Linters.enableLinter().format(linterInfo.id), Common.notNow(), Common.doNotShowAgain()];
        if (promptEnabled) {
            appShellMock
                .setup((ap) =>
                    ap.showInformationMessage(
                        TypeMoq.It.isValue(Linters.enablePylint().format(linterInfo.id)),
                        TypeMoq.It.isValue(Linters.enableLinter().format(linterInfo.id)),
                        TypeMoq.It.isAny(),
                        TypeMoq.It.isAny()
                    )
                )
                .returns(() => Promise.resolve(promptAction ? optButtons[selections.indexOf(promptAction)] : undefined))
                .verifiable(TypeMoq.Times.once());
            if (promptAction === 'disablePrompt') {
                notificationPromptEnabled
                    .setup((n) => n.updateValue(false))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());
            }
        } else {
            appShellMock
                .setup((ap) =>
                    ap.showInformationMessage(
                        TypeMoq.It.isValue(Linters.enablePylint().format(linterInfo.id)),
                        TypeMoq.It.isValue(Linters.enableLinter().format(linterInfo.id)),
                        TypeMoq.It.isAny(),
                        TypeMoq.It.isAny()
                    )
                )
                .returns(() => Promise.resolve(promptAction ? optButtons[selections.indexOf(promptAction)] : undefined))
                .verifiable(TypeMoq.Times.never());
        }

        // perform test
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );
        const result = await availabilityProvider.promptToConfigureAvailableLinter(linterInfo);
        if (promptEnabled && promptAction === 'enable') {
            expect(linterInfo.testIsEnabled).to.equal(
                true,
                'LinterInfo test class was not updated as a result of the test.'
            );
        }

        appShellMock.verifyAll();
        notificationPromptEnabled.verifyAll();

        return result;
    }

    test('Linter is enabled after being prompted and "Enable <linter>" is selected', async () => {
        // set expectations
        const expectedResult = true;
        const promptAction = 'enable';

        // run scenario
        const result = await testForLinterPromptResponse(promptAction);

        // test results
        expect(result).to.equal(
            expectedResult,
            'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.'
        );
    });

    test('Linter is left unconfigured and prompt is disabled when "Do not show again" is selected', async () => {
        // set expectations
        const expectedResult = false;
        const promptAction = 'disablePrompt';

        // run scenario
        const result = await testForLinterPromptResponse(promptAction);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return false.');
    });

    test('Linter is left unconfigured and no notification is shown if prompt is disabled', async () => {
        // set expectations
        const expectedResult = false;
        const promptAction = 'disablePrompt';

        // run scenario
        const result = await testForLinterPromptResponse(promptAction, false);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return false.');
    });

    test('Linter is left unconfigured after being prompted and the prompt is disabled without any selection made', async () => {
        // set expectation
        const promptAction = undefined;
        const expectedResult = false;

        // run scenario
        const result = await testForLinterPromptResponse(promptAction);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return false.');
    });

    test('Linter is left unconfigured when "Not now" is selected', async () => {
        // set expectation
        const promptAction = 'ignore';
        const expectedResult = false;

        // run scenario
        const result = await testForLinterPromptResponse(promptAction);

        // test results
        expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return false.');
    });

    // Options to test the implementation of the IAvailableLinterActivator.
    // All options default to values that would otherwise allow the prompt to appear.
    class AvailablityTestOverallOptions {
        public jediEnabledValue: boolean = false;
        public pylintUserEnabled?: boolean;
        public pylintWorkspaceEnabled?: boolean;
        public pylintWorkspaceFolderEnabled?: boolean;
        public linterIsInstalled: boolean = true;
        public promptAction?: 'enable' | 'disablePrompt' | 'ignore';
    }

    async function performTestOfOverallImplementation(options: AvailablityTestOverallOptions): Promise<boolean> {
        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        const selections: ['enable', 'ignore', 'disablePrompt'] = ['enable', 'ignore', 'disablePrompt'];
        const optButtons = [Linters.enableLinter().format(linterInfo.id), Common.notNow(), Common.doNotShowAgain()];
        appShellMock
            .setup((ap) =>
                ap.showInformationMessage(
                    TypeMoq.It.isValue(Linters.enablePylint().format(linterInfo.id)),
                    TypeMoq.It.isValue(Linters.enableLinter().format(linterInfo.id)),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny()
                )
            )
            .returns(() =>
                Promise.resolve(options.promptAction ? optButtons[selections.indexOf(options.promptAction)] : undefined)
            )
            .verifiable(TypeMoq.Times.once());

        const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
        workspaceServiceMock
            .setup((c) => c.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceServiceMock
            .setup((c) => c.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fsMock
            .setup((fs) => fs.fileExists(TypeMoq.It.isAny()))
            .returns(async () => options.linterIsInstalled)
            .verifiable(TypeMoq.Times.atLeastOnce());

        setupConfigurationServiceForJediSettingsTest(options.jediEnabledValue, configServiceMock);
        setupWorkspaceMockForLinterConfiguredTests(
            options.pylintUserEnabled,
            options.pylintWorkspaceEnabled,
            options.pylintWorkspaceFolderEnabled,
            workspaceServiceMock
        );

        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        factoryMock
            .setup((f) => f.createWorkspacePersistentState(TypeMoq.It.isAny(), true))
            .returns(() => notificationPromptEnabled.object);
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        // perform test
        const availabilityProvider: IAvailableLinterActivator = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );
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
        expect(expectedResult).to.equal(
            result,
            'promptIfLinterAvailable should not change any configuration when python.jediEnabled is true.'
        );
    });

    test('Overall implementation does not change configuration when linter is configured (enabled)', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        // perform test
        expect(expectedResult).to.equal(
            result,
            'Configuration should not change if the linter is configured in any way.'
        );
    });

    test('Overall implementation does not change configuration when linter is configured (disabled)', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = false;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should not change if the linter is disabled in any way.'
        );
    });

    test('Overall implementation does not change configuration when linter is unavailable in current workspace environment', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should not change if the linter is unavailable in the current workspace environment.'
        );
    });

    test('Overall implementation does not change configuration when user is prompted and prompt is dismissed', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptAction = undefined; // just being explicit for test readability - this is the default
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should not change if the user is prompted and they dismiss the prompt.'
        );
    });

    test('Overall implementation does not change configuration when user is prompted and "Do not show again" is selected', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptAction = 'disablePrompt';
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should change if the user is prompted and they choose to update the linter config.'
        );
    });

    test('Overall implementation does not change configuration when user is prompted and "Not now" is selected', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptAction = 'ignore';
        const expectedResult = false;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should change if the user is prompted and they choose to update the linter config.'
        );
    });

    test('Overall implementation changes configuration when user is prompted and "Enable <linter>" is selected', async () => {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptAction = 'enable';
        const expectedResult = true;

        // arrange
        const result = await performTestOfOverallImplementation(testOpts);

        expect(expectedResult).to.equal(
            result,
            'Configuration should change if the user is prompted and they choose to update the linter config.'
        );
    });

    test('Discovery of linter is available in the environment returns true when it succeeds and is present', async () => {
        // set expectations
        const linterIsInstalled = true;
        const expectedResult = true;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, fsMock, workspaceServiceMock);

        // perform test
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );
        const result = await availabilityProvider.isLinterAvailable(linterInfo, undefined);

        expect(result).to.equal(
            expectedResult,
            'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.'
        );
        fsMock.verifyAll();
        workspaceServiceMock.verifyAll();
    });

    test('Discovery of linter is available in the environment returns false when it succeeds and is not present', async () => {
        // set expectations
        const linterIsInstalled = false;
        const expectedResult = false;

        // arrange
        const [
            appShellMock,
            fsMock,
            workspaceServiceMock,
            configServiceMock,
            factoryMock,
            linterInfo
        ] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, fsMock, workspaceServiceMock);

        // perform test
        const availabilityProvider = new AvailableLinterActivator(
            appShellMock.object,
            fsMock.object,
            workspaceServiceMock.object,
            configServiceMock.object,
            factoryMock.object
        );
        const result = await availabilityProvider.isLinterAvailable(linterInfo, undefined);

        expect(result).to.equal(
            expectedResult,
            'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.'
        );
        fsMock.verifyAll();
        workspaceServiceMock.verifyAll();
    });

    suite('Linter Availability', () => {
        let availabilityProvider: AvailableLinterActivator;
        let workspaceService: IWorkspaceService;
        let fs: IFileSystem;
        const defaultWorkspace: WorkspaceFolder = {
            uri: Uri.file(path.join('a', 'b', 'default')),
            name: 'default',
            index: 0
        };
        const resource = Uri.file(__dirname);
        setup(() => {
            workspaceService = mock(WorkspaceService);
            fs = mock(FileSystem);

            availabilityProvider = new AvailableLinterActivator(
                instance(mock(ApplicationShell)),
                instance(fs),
                instance(workspaceService),
                instance(mock(ConfigurationService)),
                instance(mock(PersistentStateFactory))
            );
        });
        test('No linters when there are no workspaces', async () => {
            when(workspaceService.hasWorkspaceFolders).thenReturn(false);
            const linterInfo = ({} as any) as ILinterInfo;
            const available = await availabilityProvider.isLinterAvailable(linterInfo, undefined);

            expect(available).to.equal(false, 'Should be false');
        });

        [undefined, { uri: Uri.file(path.join('c', 'd', 'resource')), name: 'another', index: 10 }].forEach(
            (workspaceFolderRelatedToResource) => {
                const testSuffix = workspaceFolderRelatedToResource
                    ? '(has a corresponding workspace)'
                    : '(use default workspace)';
                // If there's a workspace, then access default workspace.
                const workspaceFolder = workspaceFolderRelatedToResource || defaultWorkspace;
                test(`No linters when there are no config files ${testSuffix}`, async () => {
                    when(workspaceService.hasWorkspaceFolders).thenReturn(true);
                    const linterInfo = ({ configFileNames: [] } as any) as ILinterInfo;
                    when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolderRelatedToResource);
                    when(workspaceService.workspaceFolders).thenReturn([defaultWorkspace]);
                    const available = await availabilityProvider.isLinterAvailable(linterInfo, resource);

                    expect(available).to.equal(false, 'Should be false');
                    verify(workspaceService.getWorkspaceFolder(resource)).once();
                    verify(fs.fileExists(anything())).never();
                    // If there's a workspace, then access default workspace.
                    if (workspaceFolderRelatedToResource) {
                        verify(workspaceService.workspaceFolders).never();
                    } else {
                        verify(workspaceService.workspaceFolders).once();
                    }
                });
                test(`No linters when there none of the config files exist ${testSuffix}`, async () => {
                    when(workspaceService.hasWorkspaceFolders).thenReturn(true);
                    const linterInfo = ({ configFileNames: ['1', '2'] } as any) as ILinterInfo;
                    when(fs.fileExists(anything())).thenResolve(false);
                    when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolderRelatedToResource);
                    when(workspaceService.workspaceFolders).thenReturn([defaultWorkspace]);

                    const available = await availabilityProvider.isLinterAvailable(linterInfo, resource);

                    expect(available).to.equal(false, 'Should be false');
                    verify(workspaceService.getWorkspaceFolder(resource)).once();
                    verify(fs.fileExists(anything())).twice();
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '1'))).once();
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '2'))).once();
                    if (workspaceFolderRelatedToResource) {
                        verify(workspaceService.workspaceFolders).never();
                    } else {
                        verify(workspaceService.workspaceFolders).once();
                    }
                });
                test(`Linters exist when all of the config files exist ${testSuffix}`, async () => {
                    when(workspaceService.hasWorkspaceFolders).thenReturn(true);
                    const linterInfo = ({ configFileNames: ['1', '2'] } as any) as ILinterInfo;
                    when(fs.fileExists(anything())).thenResolve(true);
                    when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolderRelatedToResource);
                    when(workspaceService.workspaceFolders).thenReturn([defaultWorkspace]);

                    const available = await availabilityProvider.isLinterAvailable(linterInfo, resource);

                    expect(available).to.equal(true, 'Should be true');
                    verify(workspaceService.getWorkspaceFolder(resource)).once();
                    verify(fs.fileExists(anything())).once();
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '1'))).once();
                    // Check only the first file, if that exists, no point checking the rest.
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '2'))).never();
                    if (workspaceFolderRelatedToResource) {
                        verify(workspaceService.workspaceFolders).never();
                    } else {
                        verify(workspaceService.workspaceFolders).once();
                    }
                });
                test(`Linters exist when one of the config files exist ${testSuffix}`, async () => {
                    when(workspaceService.hasWorkspaceFolders).thenReturn(true);
                    const linterInfo = ({ configFileNames: ['1', '2', '3'] } as any) as ILinterInfo;
                    when(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '1'))).thenResolve(false);
                    when(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '2'))).thenResolve(true);
                    when(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '3'))).thenResolve(false);
                    when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolderRelatedToResource);
                    when(workspaceService.workspaceFolders).thenReturn([defaultWorkspace]);

                    const available = await availabilityProvider.isLinterAvailable(linterInfo, resource);

                    expect(available).to.equal(true, 'Should be true');
                    verify(workspaceService.getWorkspaceFolder(resource)).once();
                    verify(fs.fileExists(anything())).twice();
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '1'))).once();
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '2'))).once();
                    // Check only the second file, if that exists, no point checking the rest.
                    verify(fs.fileExists(path.join(workspaceFolder.uri.fsPath, '3'))).never();
                    if (workspaceFolderRelatedToResource) {
                        verify(workspaceService.workspaceFolders).never();
                    } else {
                        verify(workspaceService.workspaceFolders).once();
                    }
                });
            }
        );
    });
});

function setupWorkspaceMockForLinterConfiguredTests(
    enabledForUser: boolean | undefined,
    enabeldForWorkspace: boolean | undefined,
    enabledForWorkspaceFolder: boolean | undefined,
    workspaceServiceMock?: TypeMoq.IMock<IWorkspaceService>
): TypeMoq.IMock<IWorkspaceService> {
    if (!workspaceServiceMock) {
        workspaceServiceMock = TypeMoq.Mock.ofType<IWorkspaceService>();
    }
    const workspaceConfiguration = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
    workspaceConfiguration
        .setup((wc) => wc.inspect(TypeMoq.It.isValue('pylintEnabled')))
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

    workspaceServiceMock
        .setup((ws) => ws.getConfiguration(TypeMoq.It.isValue('python.linting'), TypeMoq.It.isAny()))
        .returns(() => workspaceConfiguration.object)
        .verifiable(TypeMoq.Times.once());

    return workspaceServiceMock;
}

function setupConfigurationServiceForJediSettingsTest(
    jediEnabledValue: boolean,
    configServiceMock: TypeMoq.IMock<IConfigurationService>
): [TypeMoq.IMock<IConfigurationService>, TypeMoq.IMock<IPythonSettings>] {
    if (!configServiceMock) {
        configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
    }
    const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
    pythonSettings.setup((ps) => ps.jediEnabled).returns(() => jediEnabledValue);

    configServiceMock.setup((cs) => cs.getSettings()).returns(() => pythonSettings.object);
    return [configServiceMock, pythonSettings];
}

function setupInstallerForAvailabilityTest(
    _linterInfo: LinterInfo,
    linterIsInstalled: boolean,
    fsMock: TypeMoq.IMock<IFileSystem>,
    workspaceServiceMock: TypeMoq.IMock<IWorkspaceService>
): TypeMoq.IMock<IFileSystem> {
    if (!fsMock) {
        fsMock = TypeMoq.Mock.ofType<IFileSystem>();
    }
    const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
    workspaceServiceMock
        .setup((c) => c.hasWorkspaceFolders)
        .returns(() => true)
        .verifiable(TypeMoq.Times.once());
    workspaceServiceMock.setup((c) => c.workspaceFolders).returns(() => [workspaceFolder]);
    workspaceServiceMock.setup((c) => c.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
    fsMock
        .setup((fs) => fs.fileExists(TypeMoq.It.isAny()))
        .returns(() => Promise.resolve(linterIsInstalled))
        .verifiable(TypeMoq.Times.atLeastOnce());

    return fsMock;
}

function getDependenciesForAvailabilityTests(): [
    TypeMoq.IMock<IApplicationShell>,
    TypeMoq.IMock<IFileSystem>,
    TypeMoq.IMock<IWorkspaceService>,
    TypeMoq.IMock<IConfigurationService>,
    TypeMoq.IMock<IPersistentStateFactory>,
    LinterInfo
] {
    const configServiceMock = TypeMoq.Mock.ofType<IConfigurationService>();
    return [
        TypeMoq.Mock.ofType<IApplicationShell>(),
        TypeMoq.Mock.ofType<IFileSystem>(),
        TypeMoq.Mock.ofType<IWorkspaceService>(),
        TypeMoq.Mock.ofType<IConfigurationService>(),
        TypeMoq.Mock.ofType<IPersistentStateFactory>(),
        new LinterInfo(Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc'])
    ];
}
