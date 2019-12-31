// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ActiveResourceService } from '../common/application/activeResource';
import { IActiveResourceService } from '../common/application/types';
import { INugetRepository } from '../common/nuget/types';
import { BANNER_NAME_DS_SURVEY, BANNER_NAME_INTERACTIVE_SHIFTENTER, BANNER_NAME_LS_SURVEY, BANNER_NAME_PROPOSE_LS, IPythonExtensionBanner } from '../common/types';
import { DataScienceSurveyBanner } from '../datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../datascience/shiftEnterBanner';
import { IServiceManager } from '../ioc/types';
import { LanguageServerSurveyBanner } from '../languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../languageServices/proposeLanguageServerBanner';
import { AATesting } from './aaTesting';
import { ExtensionActivationManager } from './activationManager';
import { LanguageServerExtensionActivationService } from './activationService';
import { ExtensionSurveyPrompt } from './extensionSurvey';
import { JediExtensionActivator } from './jedi';
import { LanguageServerExtensionActivator } from './languageServer/activator';
import { LanguageServerAnalysisOptions } from './languageServer/analysisOptions';
import { DownloadBetaChannelRule, DownloadDailyChannelRule } from './languageServer/downloadChannelRules';
import { LanguageServerDownloader } from './languageServer/downloader';
import { BaseLanguageClientFactory, DownloadedLanguageClientFactory, SimpleLanguageClientFactory } from './languageServer/languageClientFactory';
import { LanguageServerCompatibilityService } from './languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from './languageServer/languageServerExtension';
import { LanguageServerFolderService } from './languageServer/languageServerFolderService';
import {
    BetaLanguageServerPackageRepository,
    DailyLanguageServerPackageRepository,
    LanguageServerDownloadChannel,
    StableLanguageServerPackageRepository
} from './languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from './languageServer/languageServerPackageService';
import { LanguageServerProxy } from './languageServer/languageServerProxy';
import { LanguageServerManager } from './languageServer/manager';
import { LanguageServerOutputChannel } from './languageServer/outputChannel';
import { PlatformData } from './languageServer/platformData';
import { NoLanguageServerExtensionActivator } from './none/activator';
import {
    IDownloadChannelRule,
    IExtensionActivationManager,
    IExtensionActivationService,
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
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService);
    serviceManager.addBinding(ILanguageServerCache, IExtensionActivationService);
    serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, JediExtensionActivator, LanguageServerType.Jedi);
    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, LanguageServerExtensionActivator, LanguageServerType.Microsoft);
    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NoLanguageServerExtensionActivator, LanguageServerType.None);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, LanguageServerSurveyBanner, BANNER_NAME_LS_SURVEY);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, ProposeLanguageServerBanner, BANNER_NAME_PROPOSE_LS);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, DataScienceSurveyBanner, BANNER_NAME_DS_SURVEY);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, InteractiveShiftEnterBanner, BANNER_NAME_INTERACTIVE_SHIFTENTER);
    serviceManager.addSingleton<ILanguageServerFolderService>(ILanguageServerFolderService, LanguageServerFolderService);
    serviceManager.addSingleton<ILanguageServerPackageService>(ILanguageServerPackageService, LanguageServerPackageService);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, StableLanguageServerPackageRepository, LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, BetaLanguageServerPackageRepository, LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, DailyLanguageServerPackageRepository, LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadDailyChannelRule, LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton<ILanagueServerCompatibilityService>(ILanagueServerCompatibilityService, LanguageServerCompatibilityService);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, BaseLanguageClientFactory, LanguageClientFactory.base);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DownloadedLanguageClientFactory, LanguageClientFactory.downloaded);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, SimpleLanguageClientFactory, LanguageClientFactory.simple);
    serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader);
    serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData);
    serviceManager.add<ILanguageServerAnalysisOptions>(ILanguageServerAnalysisOptions, LanguageServerAnalysisOptions);
    serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, LanguageServerProxy);
    serviceManager.add<ILanguageServerManager>(ILanguageServerManager, LanguageServerManager);
    serviceManager.addSingleton<ILanguageServerOutputChannel>(ILanguageServerOutputChannel, LanguageServerOutputChannel);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ExtensionSurveyPrompt);
    serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, AATesting);
}
