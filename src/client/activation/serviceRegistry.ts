// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { INugetRepository } from '../common/nuget/types';
import { BANNER_NAME_DS_SURVEY, BANNER_NAME_INTERACTIVE_SHIFTENTER, BANNER_NAME_LS_SURVEY, BANNER_NAME_PROPOSE_LS, IPythonExtensionBanner } from '../common/types';
import { DataScienceSurveyBanner } from '../datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../datascience/shiftEnterBanner';
import { IServiceManager } from '../ioc/types';
import { LanguageServerSurveyBanner } from '../languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../languageServices/proposeLanguageServerBanner';
import { ExtensionActivationManager } from './activationManager';
import { LanguageServerExtensionActivationService } from './activationService';
import { JediExtensionActivator } from './jedi';
import { LanguageServerExtensionActivator } from './languageServer/activator';
import { LanguageServerAnalysisOptions } from './languageServer/analysisOptions';
import { DownloadBetaChannelRule, DownloadDailyChannelRule, DownloadStableChannelRule } from './languageServer/downloadChannelRules';
import { LanguageServerDownloader } from './languageServer/downloader';
import { InterpreterDataService } from './languageServer/interpreterDataService';
import { BaseLanguageClientFactory, DownloadedLanguageClientFactory, SimpleLanguageClientFactory } from './languageServer/languageClientFactory';
import { LanguageServer } from './languageServer/languageServer';
import { LanguageServerCompatibilityService } from './languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from './languageServer/languageServerExtension';
import { LanguageServerFolderService } from './languageServer/languageServerFolderService';
import { BetaLanguageServerPackageRepository, DailyLanguageServerPackageRepository, LanguageServerDownloadChannel, StableLanguageServerPackageRepository } from './languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from './languageServer/languageServerPackageService';
import { LanguageServerManager } from './languageServer/manager';
import { PlatformData } from './languageServer/platformData';
import { IDownloadChannelRule, IExtensionActivationManager, IExtensionActivationService, IInterpreterDataService, ILanguageClientFactory, ILanguageServer, ILanguageServerActivator, ILanguageServerAnalysisOptions, ILanguageServerCompatibilityService as ILanagueServerCompatibilityService, ILanguageServerDownloader, ILanguageServerExtension, ILanguageServerFolderService, ILanguageServerManager, ILanguageServerPackageService, IPlatformData, LanguageClientFactory, LanguageServerActivator } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, LanguageServerExtensionActivationService);
    serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, JediExtensionActivator, LanguageServerActivator.Jedi);
    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, LanguageServerExtensionActivator, LanguageServerActivator.DotNet);
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
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadStableChannelRule, LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton<ILanagueServerCompatibilityService>(ILanagueServerCompatibilityService, LanguageServerCompatibilityService);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, BaseLanguageClientFactory, LanguageClientFactory.base);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DownloadedLanguageClientFactory, LanguageClientFactory.downloaded);
    serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, SimpleLanguageClientFactory, LanguageClientFactory.simple);
    serviceManager.addSingleton<IInterpreterDataService>(IInterpreterDataService, InterpreterDataService);
    serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader);
    serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData);
    serviceManager.add<ILanguageServerAnalysisOptions>(ILanguageServerAnalysisOptions, LanguageServerAnalysisOptions);
    serviceManager.add<ILanguageServer>(ILanguageServer, LanguageServer);
    serviceManager.add<ILanguageServerManager>(ILanguageServerManager, LanguageServerManager);
}
