// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ActiveResourceService } from '../common/application/activeResource';
import { IActiveResourceService } from '../common/application/types';
import { INugetRepository } from '../common/nuget/types';
import {
    BANNER_NAME_DS_SURVEY,
    BANNER_NAME_INTERACTIVE_SHIFTENTER,
    BANNER_NAME_LS_SURVEY,
    BANNER_NAME_PROPOSE_LS,
    IConfigurationService,
    IPythonExtensionBanner
} from '../common/types';
import { DataScienceSurveyBanner } from '../datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../datascience/shiftEnterBanner';
import { IServiceManager } from '../ioc/types';
import { LanguageServerSurveyBanner } from '../languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../languageServices/proposeLanguageServerBanner';
import { AATesting } from './aaTesting';
import { ExtensionActivationManager } from './activationManager';
import { LanguageServerExtensionActivationService } from './activationService';
import { DownloadBetaChannelRule, DownloadDailyChannelRule } from './common/downloadChannelRules';
import { LanguageServerDownloader } from './common/downloader';
import { LanguageServerDownloadChannel } from './common/packageRepository';
import { ExtensionSurveyPrompt } from './extensionSurvey';
import { JediExtensionActivator } from './jedi';
import { DotNetLanguageServerActivator } from './languageServer/activator';
import { LanguageServerAnalysisOptions } from './languageServer/analysisOptions';
import { DotNetLanguageClientFactory } from './languageServer/languageClientFactory';
import { LanguageServerCompatibilityService } from './languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from './languageServer/languageServerExtension';
import { DotNetLanguageServerFolderService } from './languageServer/languageServerFolderService';
import {
    BetaDotNetLanguageServerPackageRepository,
    DailyDotNetLanguageServerPackageRepository,
    StableDotNetLanguageServerPackageRepository
} from './languageServer/languageServerPackageRepository';
import { DotNetLanguageServerPackageService } from './languageServer/languageServerPackageService';
import { LanguageServerProxy } from './languageServer/languageServerProxy';
import { DotNetLanguageServerManager } from './languageServer/manager';
import { LanguageServerOutputChannel } from './languageServer/outputChannel';
import { PlatformData } from './languageServer/platformData';
import { NodeLanguageServerActivator } from './node/activator';
import { NodeLanguageClientFactory } from './node/languageClientFactory';
import { NodeLanguageServerFolderService } from './node/languageServerFolderService';
import * as languageServerPackageService from './node/languageServerPackageService';
import { NodeLanguageServerProxy } from './node/languageServerProxy';
import { NodeLanguageServerManager } from './node/manager';
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
    LanguageServerType
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();
    const languageServerType = pythonSettings.languageServer;

    serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService);
    serviceManager.addBinding(ILanguageServerCache, IExtensionActivationService);
    serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);

    serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, JediExtensionActivator, LanguageServerType.Jedi);
    if (languageServerType === LanguageServerType.Microsoft) {
        serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, DotNetLanguageServerActivator, LanguageServerType.Microsoft);
        serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, LanguageServerSurveyBanner, BANNER_NAME_LS_SURVEY);
        serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, ProposeLanguageServerBanner, BANNER_NAME_PROPOSE_LS);
        serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, DataScienceSurveyBanner, BANNER_NAME_DS_SURVEY);
        serviceManager.addSingleton<IPythonExtensionBanner>(IPythonExtensionBanner, InteractiveShiftEnterBanner, BANNER_NAME_INTERACTIVE_SHIFTENTER);
        serviceManager.addSingleton<INugetRepository>(INugetRepository, StableDotNetLanguageServerPackageRepository, LanguageServerDownloadChannel.stable);
        serviceManager.addSingleton<INugetRepository>(INugetRepository, BetaDotNetLanguageServerPackageRepository, LanguageServerDownloadChannel.beta);
        serviceManager.addSingleton<INugetRepository>(INugetRepository, DailyDotNetLanguageServerPackageRepository, LanguageServerDownloadChannel.daily);
        serviceManager.addSingleton<ILanagueServerCompatibilityService>(ILanagueServerCompatibilityService, LanguageServerCompatibilityService);
        serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DotNetLanguageClientFactory);
        serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData);
        serviceManager.add<ILanguageServerManager>(ILanguageServerManager, DotNetLanguageServerManager, LanguageServerType.Microsoft);
        serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, LanguageServerProxy, LanguageServerType.Microsoft);
        serviceManager.add<ILanguageServerAnalysisOptions>(ILanguageServerAnalysisOptions, LanguageServerAnalysisOptions);
        serviceManager.addSingleton<ILanguageServerFolderService>(ILanguageServerFolderService, DotNetLanguageServerFolderService);
        serviceManager.addSingleton<ILanguageServerPackageService>(ILanguageServerPackageService, DotNetLanguageServerPackageService);
    } else if (languageServerType === LanguageServerType.Node) {
        serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NodeLanguageServerActivator, LanguageServerType.Node);
        serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, NodeLanguageClientFactory, LanguageServerType.Node);
        serviceManager.add<ILanguageServerManager>(ILanguageServerManager, NodeLanguageServerManager, LanguageServerType.Node);
        serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, NodeLanguageServerProxy, LanguageServerType.Node);
        serviceManager.addSingleton<ILanguageServerFolderService>(ILanguageServerFolderService, NodeLanguageServerFolderService);
        serviceManager.addSingleton<ILanguageServerPackageService>(ILanguageServerPackageService, languageServerPackageService.NodeLanguageServerPackageService);
    } else if (languageServerType === LanguageServerType.None) {
        serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NoLanguageServerExtensionActivator, LanguageServerType.None);
    }

    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadDailyChannelRule, LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton<IDownloadChannelRule>(IDownloadChannelRule, DownloadBetaChannelRule, LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader);

    serviceManager.addSingleton<ILanguageServerOutputChannel>(ILanguageServerOutputChannel, LanguageServerOutputChannel);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ExtensionSurveyPrompt);
    serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, AATesting);
}
