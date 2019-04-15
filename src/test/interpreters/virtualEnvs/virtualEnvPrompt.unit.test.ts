// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, Uri, WorkspaceConfiguration } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { Common, InteractiveShiftEnterBanner } from '../../../client/common/utils/localize';
import { PythonPathUpdaterService } from '../../../client/interpreter/configuration/pythonPathUpdaterService';
import { IPythonPathUpdaterServiceManager } from '../../../client/interpreter/configuration/types';
import { IInterpreterHelper, IInterpreterLocatorService, IInterpreterWatcherBuilder, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../client/interpreter/helpers';
import { CacheableLocatorService } from '../../../client/interpreter/locators/services/cacheableLocatorService';
import { InterpreterWatcherBuilder } from '../../../client/interpreter/locators/services/interpreterWatcherBuilder';
import { VirtualEnvironmentPrompt } from '../../../client/interpreter/virtualEnvs/virtualEnvPrompt';

// tslint:disable-next-line:max-func-body-length
suite('Virtual Environment Prompt', () => {
    class VirtualEnvironmentPromptTest extends VirtualEnvironmentPrompt {
        // tslint:disable-next-line:no-unnecessary-override
        public async handleNewEnvironment(resource: Uri): Promise<void> {
            await super.handleNewEnvironment(resource);
        }
        // tslint:disable-next-line:no-unnecessary-override
        public async notifyUser(interpreter: PythonInterpreter, resource: Uri): Promise<void> {
            await super.notifyUser(interpreter, resource);
        }
        // tslint:disable-next-line:no-unnecessary-override
        public hasUserDefinedPythonPath(resource: Uri) {
            return super.hasUserDefinedPythonPath(resource);
        }
    }
    let builder: IInterpreterWatcherBuilder;
    let workspaceService: IWorkspaceService;
    let persistentStateFactory: IPersistentStateFactory;
    let helper: IInterpreterHelper;
    let pythonPathUpdaterService: IPythonPathUpdaterServiceManager;
    let locator: IInterpreterLocatorService;
    let disposable: Disposable;
    let appShell: IApplicationShell;
    let environmentPrompt: VirtualEnvironmentPromptTest;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        builder = mock(InterpreterWatcherBuilder);
        persistentStateFactory = mock(PersistentStateFactory);
        helper = mock(InterpreterHelper);
        pythonPathUpdaterService = mock(PythonPathUpdaterService);
        locator = mock(CacheableLocatorService);
        disposable = mock(Disposable);
        appShell = mock(ApplicationShell);
        environmentPrompt = new VirtualEnvironmentPromptTest(
            instance(builder),
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(helper),
            instance(pythonPathUpdaterService),
            instance(locator),
            [instance(disposable)],
            instance(appShell)
        );
    });
    test('User is not notified if python path is specified in settings.json', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const interpreter2 = { path: 'path/to/interpreter2' };
        const settings = { workspaceFolderValue: 'path/to/interpreter1' };
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        // tslint:disable:no-any
        when(locator.getInterpreters(resource)).thenResolve([interpreter1, interpreter2] as any);
        when(helper.getBestInterpreter(anything())).thenReturn(interpreter2 as any);
        when(workspaceService.getConfiguration('python', resource)).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());

        await environmentPrompt.handleNewEnvironment(resource);

        verify(locator.getInterpreters(resource)).once();
        verify(helper.getBestInterpreter(anything())).once();
        verify(workspaceService.getConfiguration('python', resource)).once();
        workspaceConfig.verifyAll();
    });

    test('User is notified if interpreter exists and only python path to global interpreter is specified in settings', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const interpreter2 = { path: 'path/to/interpreter2' };
        const settings = { workspaceFolderValue: 'python', globalValue: 'path/to/globalInterpreter' };
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        // tslint:disable:no-any
        when(locator.getInterpreters(resource)).thenResolve([interpreter1, interpreter2] as any);
        when(helper.getBestInterpreter(anything())).thenReturn(interpreter2 as any);
        when(workspaceService.getConfiguration('python', resource)).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(notificationPromptEnabled.object);
        notificationPromptEnabled.setup(n => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve();

        await environmentPrompt.handleNewEnvironment(resource);

        verify(locator.getInterpreters(resource)).once();
        verify(helper.getBestInterpreter(anything())).once();
        verify(workspaceService.getConfiguration('python', resource)).once();
        workspaceConfig.verifyAll();
        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
    });

    test('If user selects \'Yes\', python path is updated', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(notificationPromptEnabled.object);
        notificationPromptEnabled.setup(n => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[0] as any);
        when(pythonPathUpdaterService.updatePythonPath(interpreter1.path, ConfigurationTarget.WorkspaceFolder, 'ui', resource)).thenResolve();

        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        verify(pythonPathUpdaterService.updatePythonPath(interpreter1.path, ConfigurationTarget.WorkspaceFolder, 'ui', resource)).once();
    });

    test('If user selects \'No\', no operation is performed', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(notificationPromptEnabled.object);
        notificationPromptEnabled.setup(n => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[1] as any);
        when(pythonPathUpdaterService.updatePythonPath(interpreter1.path, ConfigurationTarget.WorkspaceFolder, 'ui', resource)).thenResolve();
        notificationPromptEnabled.setup(n => n.updateValue(false)).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.never());

        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        verify(pythonPathUpdaterService.updatePythonPath(interpreter1.path, ConfigurationTarget.WorkspaceFolder, 'ui', resource)).never();
        notificationPromptEnabled.verifyAll();
    });

    test('If user selects \'Do not show again\', prompt is disabled', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(notificationPromptEnabled.object);
        notificationPromptEnabled.setup(n => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[2] as any);
        notificationPromptEnabled.setup(n => n.updateValue(false)).returns(() => Promise.resolve()).verifiable(TypeMoq.Times.once());

        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        notificationPromptEnabled.verifyAll();
    });

    test('If prompt is disabled, no notification is shown', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [InteractiveShiftEnterBanner.bannerLabelYes(), InteractiveShiftEnterBanner.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(notificationPromptEnabled.object);
        notificationPromptEnabled.setup(n => n.value).returns(() => false);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[0] as any);

        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).never();
    });

    const testsForHasUserDefinedPath =
        [
            {
                testName: 'Returns false when workspace folder setting equals \'python\'',
                settings: { workspaceFolderValue: 'python' },
                expectedResult: false
            },
            {
                testName: 'Returns true when interpreter is provided in workspace folder setting',
                settings: { workspaceFolderValue: 'path/to/interpreter' },
                expectedResult: true
            },
            {
                testName: 'Returns false when workspace setting equals \'python\'',
                settings: { workspaceValue: 'python' },
                expectedResult: false
            },
            {
                testName: 'Returns true when interpreter is provided in workspace setting',
                settings: { workspaceValue: 'path/to/interpreter' },
                expectedResult: true
            },
            {
                testName: 'Returns false when global setting equals \'python\'',
                settings: { globalValue: 'python' },
                expectedResult: false
            },
            {
                testName: 'Returns false when interpreter is provided in global setting',
                settings: { globalValue: 'path/to/interpreter' },
                expectedResult: false
            },
            {
                testName: 'Returns false when no python setting is provided',
                settings: {},
                expectedResult: false
            }
        ];

    suite('Function hasUserDefinedPythonPath()', () => {
        testsForHasUserDefinedPath.forEach(testParams => {
            test(testParams.testName, async () => {
                const resource = Uri.parse('a');
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                when(workspaceService.getConfiguration('python', resource)).thenReturn(workspaceConfig.object);
                workspaceConfig.setup(c => c.inspect<string>('pythonPath'))
                    .returns(() => testParams.settings as any)
                    .verifiable(TypeMoq.Times.once());

                expect(environmentPrompt.hasUserDefinedPythonPath(resource)).to.equal(testParams.expectedResult);

                verify(workspaceService.getConfiguration('python', resource)).once();
                workspaceConfig.verifyAll();
            });
        });
    });
});
