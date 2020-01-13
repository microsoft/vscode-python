// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { instance, mock, verify } from 'ts-mockito';

import { AATesting } from '../../client/activation/aaTesting';
import { ExtensionActivationManager } from '../../client/activation/activationManager';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { ExtensionSurveyPrompt } from '../../client/activation/extensionSurvey';
import { JediExtensionActivator } from '../../client/activation/jedi';
import { LanguageServerExtensionActivator } from '../../client/activation/languageServer/activator';
import { LanguageServerAnalysisOptions } from '../../client/activation/languageServer/analysisOptions';
import { DownloadBetaChannelRule, DownloadDailyChannelRule } from '../../client/activation/languageServer/downloadChannelRules';
import { LanguageServerDownloader } from '../../client/activation/languageServer/downloader';
import { BaseLanguageClientFactory, DownloadedLanguageClientFactory, SimpleLanguageClientFactory } from '../../client/activation/languageServer/languageClientFactory';
import { LanguageServerCompatibilityService } from '../../client/activation/languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from '../../client/activation/languageServer/languageServerExtension';
import { LanguageServerFolderService } from '../../client/activation/languageServer/languageServerFolderService';
import {
    BetaLanguageServerPackageRepository,
    DailyLanguageServerPackageRepository,
    LanguageServerDownloadChannel,
    StableLanguageServerPackageRepository
} from '../../client/activation/languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from '../../client/activation/languageServer/languageServerPackageService';
import { LanguageServerProxy } from '../../client/activation/languageServer/languageServerProxy';
import { LanguageServerManager } from '../../client/activation/languageServer/manager';
import { LanguageServerOutputChannel } from '../../client/activation/languageServer/outputChannel';
import { PlatformData } from '../../client/activation/languageServer/platformData';
import { NodeLanguageServerActivator } from '../../client/activation/node/activator';
import { NoLanguageServerExtensionActivator } from '../../client/activation/none/activator';
import { registerTypes } from '../../client/activation/serviceRegistry';
import {
    IDownloadChannelRule,
    IExtensionActivationManager,
    IExtensionSingleActivationService,
    ILanguageClientFactory,
    ILanguageServerActivator,
    ILanguageServerAnalysisOptions,
    ILanguageServerCache,
    ILanguageServerCompatibilityService as ILanagueServerCompatibilityService,
    ILanguageServerDownloader,
    ILanguageServerExtension,
    ILanguageServerFolderService,
    ILanguageServerManager,
    ILanguageServerOutputChannel,
    ILanguageServerPackageService,
    ILanguageServerProxy,
    IPlatformData,
    LanguageClientFactory,
    LanguageServerType
} from '../../client/activation/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { IActiveResourceService } from '../../client/common/application/types';
import { INugetRepository } from '../../client/common/nuget/types';
import { BANNER_NAME_DS_SURVEY, BANNER_NAME_INTERACTIVE_SHIFTENTER, BANNER_NAME_LS_SURVEY, BANNER_NAME_PROPOSE_LS, IPythonExtensionBanner } from '../../client/common/types';
import { DataScienceSurveyBanner } from '../../client/datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../../client/datascience/shiftEnterBanner';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { LanguageServerSurveyBanner } from '../../client/languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../../client/languageServices/proposeLanguageServerBanner';

suite('Unit Tests - Language Server Activation Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));

        verify(serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService)).once();
        verify(serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension)).once();
        verify(serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager)).once();
        verify(serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, JediExtensionActivator, LanguageServerType.Jedi)).once();
        verify(serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, LanguageServerExtensionActivator, LanguageServerType.Microsoft)).once();
        verify(serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NoLanguageServerExtensionActivator, LanguageServerType.None)).once();
        verify(serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NodeLanguageServerActivator, LanguageServerType.Node)).once();
        verify(serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, LanguageServerSurveyBanner, BANNER_NAME_LS_SURVEY)).once();
        verify(serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, ProposeLanguageServerBanner, BANNER_NAME_PROPOSE_LS)).once();
        verify(serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, DataScienceSurveyBanner, BANNER_NAME_DS_SURVEY)).once();
        verify(serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, InteractiveShiftEnterBanner, BANNER_NAME_INTERACTIVE_SHIFTENTER)).once();
        verify(serviceManager.addSingleton<ILanguageServerFolderService>(ILanguageServerFolderService, LanguageServerFolderService)).once();
        verify(serviceManager.addSingleton<ILanguageServerPackageService>(ILanguageServerPackageService, LanguageServerPackageService)).once();
        verify(serviceManager.addSingleton<INugetRepository>(INugetRepository, StableLanguageServerPackageRepository, LanguageServerDownloadChannel.stable)).once();
        verify(serviceManager.addSingleton<INugetRepository>(INugetRepository, BetaLanguageServerPackageRepository, LanguageServerDownloadChannel.beta)).once();
        verify(serviceManager.addSingleton<INugetRepository>(INugetRepository, DailyLanguageServerPackageRepository, LanguageServerDownloadChannel.daily)).once();
        verify(serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadDailyChannelRule, LanguageServerDownloadChannel.daily)).once();
        verify(serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.beta)).once();
        verify(serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.stable)).once();
        verify(serviceManager.addSingleton<ILanagueServerCompatibilityService>(ILanagueServerCompatibilityService, LanguageServerCompatibilityService)).once();
        verify(serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, BaseLanguageClientFactory, LanguageClientFactory.base)).once();
        verify(serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DownloadedLanguageClientFactory, LanguageClientFactory.downloaded)).once();
        verify(serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, SimpleLanguageClientFactory, LanguageClientFactory.simple)).once();
        verify(serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader)).once();
        verify(serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData)).once();
        verify(serviceManager.add<ILanguageServerAnalysisOptions>(ILanguageServerAnalysisOptions, LanguageServerAnalysisOptions)).once();
        verify(serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, LanguageServerProxy, LanguageServerType.Microsoft)).once();
        verify(serviceManager.add<ILanguageServerManager>(ILanguageServerManager, LanguageServerManager, LanguageServerType.Microsoft)).once();
        verify(serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, AATesting)).once();
        verify(serviceManager.addSingleton<ILanguageServerOutputChannel>(ILanguageServerOutputChannel, LanguageServerOutputChannel)).once();
        verify(serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService)).once();
        verify(serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ExtensionSurveyPrompt)).once();
    });
});
