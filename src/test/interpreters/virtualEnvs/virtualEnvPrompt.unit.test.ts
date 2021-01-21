// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, reset, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { DiscoveryVariants } from '../../../client/common/experiments/groups';
import { ExperimentService } from '../../../client/common/experiments/service';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IExperimentService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { Common } from '../../../client/common/utils/localize';
import { PythonPathUpdaterService } from '../../../client/interpreter/configuration/pythonPathUpdaterService';
import { IPythonPathUpdaterServiceManager } from '../../../client/interpreter/configuration/types';
import {
    IComponentAdapter,
    IInterpreterHelper,
    IInterpreterLocatorService,
    IInterpreterWatcherBuilder,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../client/interpreter/helpers';
import { VirtualEnvironmentPrompt } from '../../../client/interpreter/virtualEnvs/virtualEnvPrompt';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { CacheableLocatorService } from '../../../client/pythonEnvironments/discovery/locators/services/cacheableLocatorService';
import { InterpreterWatcherBuilder } from '../../../client/pythonEnvironments/discovery/locators/services/interpreterWatcherBuilder';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';

suite('Virtual Environment Prompt', () => {
    class VirtualEnvironmentPromptTest extends VirtualEnvironmentPrompt {
        public async handleNewEnvironment(resource: Uri): Promise<void> {
            await super.handleNewEnvironment(resource);
        }

        public async notifyUser(interpreter: PythonEnvironment, resource: Uri): Promise<void> {
            await super.notifyUser(interpreter, resource);
        }
    }
    let builder: IInterpreterWatcherBuilder;
    let persistentStateFactory: IPersistentStateFactory;
    let helper: IInterpreterHelper;
    let pythonPathUpdaterService: IPythonPathUpdaterServiceManager;
    let locator: IInterpreterLocatorService;
    let disposable: Disposable;
    let appShell: IApplicationShell;
    let serviceContainer: IServiceContainer;
    let componentAdapter: IComponentAdapter;
    let experimentService: IExperimentService;
    let environmentPrompt: VirtualEnvironmentPromptTest;
    setup(() => {
        builder = mock(InterpreterWatcherBuilder);
        serviceContainer = mock(ServiceContainer);
        persistentStateFactory = mock(PersistentStateFactory);
        helper = mock(InterpreterHelper);
        experimentService = mock(ExperimentService);
        pythonPathUpdaterService = mock(PythonPathUpdaterService);
        locator = mock(CacheableLocatorService);
        componentAdapter = mock<IComponentAdapter>();
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(false);
        when(
            serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE),
        ).thenReturn(instance(locator));
        when(serviceContainer.get<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder)).thenReturn(
            instance(builder),
        );
        disposable = mock(Disposable);
        appShell = mock(ApplicationShell);
        environmentPrompt = new VirtualEnvironmentPromptTest(
            instance(serviceContainer),
            instance(persistentStateFactory),
            instance(helper),
            instance(pythonPathUpdaterService),
            [instance(disposable)],
            instance(appShell),
            instance(componentAdapter),
            instance(experimentService),
        );
    });

    test('User is notified if interpreter exists and only python path to global interpreter is specified in settings', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const interpreter2 = { path: 'path/to/interpreter2' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(locator.getInterpreters(resource)).thenResolve([interpreter1, interpreter2] as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(helper.getBestInterpreter(deepEqual([interpreter1, interpreter2] as any))).thenReturn(interpreter2 as any);
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve();

        await environmentPrompt.handleNewEnvironment(resource);

        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
    });

    test('When in experiment, user is notified if interpreter exists and only python path to global interpreter is specified in settings', async () => {
        const resource = Uri.file('a');
        reset(experimentService);
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(true);
        const interpreter1 = { path: 'path/to/interpreter1' };
        const interpreter2 = { path: 'path/to/interpreter2' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();

        // Return interpreters using the component adapter instead
        when(componentAdapter.getWorkspaceVirtualEnvInterpreters(resource)).thenResolve([
            interpreter1,
            interpreter2,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(helper.getBestInterpreter(deepEqual([interpreter1, interpreter2] as any))).thenReturn(interpreter2 as any);
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve();

        await environmentPrompt.handleNewEnvironment(resource);

        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
    });

    test("If user selects 'Yes', python path is updated", async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[0] as any);
        when(
            pythonPathUpdaterService.updatePythonPath(
                interpreter1.path,
                ConfigurationTarget.WorkspaceFolder,
                'ui',
                resource,
            ),
        ).thenResolve();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        verify(
            pythonPathUpdaterService.updatePythonPath(
                interpreter1.path,
                ConfigurationTarget.WorkspaceFolder,
                'ui',
                resource,
            ),
        ).once();
    });

    test("If user selects 'No', no operation is performed", async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[1] as any);
        when(
            pythonPathUpdaterService.updatePythonPath(
                interpreter1.path,
                ConfigurationTarget.WorkspaceFolder,
                'ui',
                resource,
            ),
        ).thenResolve();
        notificationPromptEnabled
            .setup((n) => n.updateValue(false))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        verify(
            pythonPathUpdaterService.updatePythonPath(
                interpreter1.path,
                ConfigurationTarget.WorkspaceFolder,
                'ui',
                resource,
            ),
        ).never();
        notificationPromptEnabled.verifyAll();
    });

    test("If user selects 'Do not show again', prompt is disabled", async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[2] as any);
        notificationPromptEnabled
            .setup((n) => n.updateValue(false))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).once();
        notificationPromptEnabled.verifyAll();
    });

    test('If prompt is disabled, no notification is shown', async () => {
        const resource = Uri.file('a');
        const interpreter1 = { path: 'path/to/interpreter1' };
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.doNotShowAgain()];
        const notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentStateFactory.createWorkspacePersistentState(anything(), true)).thenReturn(
            notificationPromptEnabled.object,
        );
        notificationPromptEnabled.setup((n) => n.value).returns(() => false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(appShell.showInformationMessage(anything(), ...prompts)).thenResolve(prompts[0] as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await environmentPrompt.notifyUser(interpreter1 as any, resource);

        verify(persistentStateFactory.createWorkspacePersistentState(anything(), true)).once();
        verify(appShell.showInformationMessage(anything(), ...prompts)).never();
    });
});
