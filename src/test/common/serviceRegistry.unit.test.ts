// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { CommandManager } from '../../client/common/application/commandManager';
import { DebugService } from '../../client/common/application/debugService';
import { DocumentManager } from '../../client/common/application/documentManager';
import { Extensions } from '../../client/common/application/extensions';
import { LanguageService } from '../../client/common/application/languageService';
import { TerminalManager } from '../../client/common/application/terminalManager';
import {
    IActiveResourceService,
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDebugService,
    IDocumentManager,
    ILanguageService,
    ITerminalManager,
    IWorkspaceService,
} from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { ConfigurationService } from '../../client/common/configuration/service';
import { PipEnvExecutionPath } from '../../client/common/configuration/executionSettings/pipEnvExecution';
import { EditorUtils } from '../../client/common/editor';
import {
    ExtensionInsidersDailyChannelRule,
    ExtensionInsidersOffChannelRule,
    ExtensionInsidersWeeklyChannelRule,
} from '../../client/common/insidersBuild/downloadChannelRules';
import { ExtensionChannelService } from '../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from '../../client/common/insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from '../../client/common/insidersBuild/insidersExtensionService';
import {
    ExtensionChannel,
    IExtensionChannelRule,
    IExtensionChannelService,
    IInsiderExtensionPrompt,
} from '../../client/common/insidersBuild/types';
import { ProductInstaller } from '../../client/common/installer/productInstaller';
import { InterpreterPathService } from '../../client/common/interpreterPathService';
import { BrowserService } from '../../client/common/net/browser';
import { HttpClient } from '../../client/common/net/httpClient';
import { NugetService } from '../../client/common/nuget/nugetService';
import { INugetService } from '../../client/common/nuget/types';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { registerTypes } from '../../client/common/serviceRegistry';
import { TerminalActivator } from '../../client/common/terminal/activator';
import { PowershellTerminalActivationFailedHandler } from '../../client/common/terminal/activator/powershellFailedHandler';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { CondaActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import { PipEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import { PyEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalServiceFactory } from '../../client/common/terminal/factory';
import { TerminalHelper } from '../../client/common/terminal/helper';
import { SettingsShellDetector } from '../../client/common/terminal/shellDetectors/settingsShellDetector';
import { TerminalNameShellDetector } from '../../client/common/terminal/shellDetectors/terminalNameShellDetector';
import { UserEnvironmentShellDetector } from '../../client/common/terminal/shellDetectors/userEnvironmentShellDetector';
import { VSCEnvironmentShellDetector } from '../../client/common/terminal/shellDetectors/vscEnvironmentShellDetector';
import {
    IShellDetector,
    ITerminalActivationCommandProvider,
    ITerminalActivationHandler,
    ITerminalActivator,
    ITerminalHelper,
    ITerminalServiceFactory,
    TerminalActivationProviders,
} from '../../client/common/terminal/types';
import {
    IAsyncDisposableRegistry,
    IBrowserService,
    IConfigurationService,
    ICurrentProcess,
    IEditorUtils,
    IExtensions,
    IHttpClient,
    IInstaller,
    IInterpreterPathService,
    IPathUtils,
    IPersistentStateFactory,
    IRandom,
    IToolExecutionPath,
    ToolExecutionPath,
} from '../../client/common/types';
import { IMultiStepInputFactory, MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { Random } from '../../client/common/utils/random';
import { IServiceManager } from '../../client/ioc/types';
import { ImportTracker } from '../../client/telemetry/importTracker';
import { IImportTracker } from '../../client/telemetry/types';

suite('Common - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = typemoq.Mock.ofType<IServiceManager>();

        [
            [IActiveResourceService, ActiveResourceService],
            [IInterpreterPathService, InterpreterPathService],
            [IExtensions, Extensions],
            [IRandom, Random],
            [IPersistentStateFactory, PersistentStateFactory],
            [ITerminalServiceFactory, TerminalServiceFactory],
            [IPathUtils, PathUtils],
            [IApplicationShell, ApplicationShell],
            [ICurrentProcess, CurrentProcess],
            [IInstaller, ProductInstaller],
            [ICommandManager, CommandManager],
            [IConfigurationService, ConfigurationService],
            [IWorkspaceService, WorkspaceService],
            [IDocumentManager, DocumentManager],
            [ITerminalManager, TerminalManager],
            [IDebugService, DebugService],
            [IApplicationEnvironment, ApplicationEnvironment],
            [ILanguageService, LanguageService],
            [IBrowserService, BrowserService],
            [IHttpClient, HttpClient],
            [IEditorUtils, EditorUtils],
            [INugetService, NugetService],
            [ITerminalActivator, TerminalActivator],
            [ITerminalActivationHandler, PowershellTerminalActivationFailedHandler],
            [ITerminalHelper, TerminalHelper],
            [ITerminalActivationCommandProvider, PyEnvActivationCommandProvider, TerminalActivationProviders.pyenv],
            [ITerminalActivationCommandProvider, Bash, TerminalActivationProviders.bashCShellFish],
            [
                ITerminalActivationCommandProvider,
                CommandPromptAndPowerShell,
                TerminalActivationProviders.commandPromptAndPowerShell,
            ],
            [IToolExecutionPath, PipEnvExecutionPath, ToolExecutionPath.pipenv],
            [ITerminalActivationCommandProvider, CondaActivationCommandProvider, TerminalActivationProviders.conda],
            [ITerminalActivationCommandProvider, PipEnvActivationCommandProvider, TerminalActivationProviders.pipenv],
            [IAsyncDisposableRegistry, AsyncDisposableRegistry],
            [IMultiStepInputFactory, MultiStepInputFactory],
            [IImportTracker, ImportTracker],
            [IShellDetector, TerminalNameShellDetector],
            [IShellDetector, SettingsShellDetector],
            [IShellDetector, UserEnvironmentShellDetector],
            [IShellDetector, VSCEnvironmentShellDetector],
            [IInsiderExtensionPrompt, InsidersExtensionPrompt],
            [IExtensionSingleActivationService, InsidersExtensionService],
            [IExtensionChannelService, ExtensionChannelService],
            [IExtensionChannelRule, ExtensionInsidersOffChannelRule, ExtensionChannel.off],
            [IExtensionChannelRule, ExtensionInsidersDailyChannelRule, ExtensionChannel.daily],
            [IExtensionChannelRule, ExtensionInsidersWeeklyChannelRule, ExtensionChannel.weekly],
        ].forEach((mapping) => {
            if (mapping.length === 2) {
                serviceManager
                    .setup((s) =>
                        s.addSingleton(
                            typemoq.It.isValue(mapping[0] as any),
                            typemoq.It.is((value) => mapping[1] === value),
                        ),
                    )
                    .verifiable(typemoq.Times.atLeastOnce());
            } else {
                serviceManager
                    .setup((s) =>
                        s.addSingleton(
                            typemoq.It.isValue(mapping[0] as any),
                            typemoq.It.isAny(),
                            typemoq.It.isValue(mapping[2] as any),
                        ),
                    )
                    .callback((_, cls) => expect(cls).to.equal(mapping[1]))
                    .verifiable(typemoq.Times.once());
            }
        });

        registerTypes(serviceManager.object);
        serviceManager.verifyAll();
    });
});
