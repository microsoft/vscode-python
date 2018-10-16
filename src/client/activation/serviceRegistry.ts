// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { INugetRepository } from '../common/nuget/types';
import { BANNER_NAME_LS_SURVEY, BANNER_NAME_PROPOSE_LS, IPythonExtensionBanner } from '../common/types';
import { IServiceManager } from '../ioc/types';
import { LanguageServerSurveyBanner } from '../languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../languageServices/proposeLanguageServerBanner';
import { ExtensionActivationService } from './activationService';
import { DownloadBetaChannelRule, DownloadDailyChannelRule, DownloadStableChannelRule } from './downloadChannelRules';
import { JediExtensionActivator } from './jedi';
import { LanguageServerExtensionActivator } from './languageServer/languageServer';
import { LanguageServerFolderService } from './languageServer/languageServerFolderService';
import { BetaLanguageServerPackageRepository, DailyLanguageServerPackageRepository, LanguageServerDownloadChannel, StableLanguageServerPackageRepository } from './languageServer/languageServerPackageRepository';
import { LanguageServerPackageService } from './languageServer/languageServerPackageService';
import { ExtensionActivators, IDownloadChannelRule, IExtensionActivationService, IExtensionActivator, ILanguageServerFolderService, ILanguageServerPackageService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, ExtensionActivationService);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, JediExtensionActivator, ExtensionActivators.Jedi);
    serviceManager.add<IExtensionActivator>(IExtensionActivator, LanguageServerExtensionActivator, ExtensionActivators.DotNet);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, LanguageServerSurveyBanner, BANNER_NAME_LS_SURVEY);
    serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, ProposeLanguageServerBanner, BANNER_NAME_PROPOSE_LS);
    serviceManager.addSingleton<ILanguageServerFolderService>(ILanguageServerFolderService, LanguageServerFolderService);
    serviceManager.addSingleton<ILanguageServerPackageService>(ILanguageServerPackageService, LanguageServerPackageService);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, StableLanguageServerPackageRepository, LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, BetaLanguageServerPackageRepository, LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton<INugetRepository>(INugetRepository, DailyLanguageServerPackageRepository, LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadDailyChannelRule, LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadStableChannelRule, LanguageServerDownloadChannel.stable);
}
