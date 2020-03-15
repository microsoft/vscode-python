// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { instance, mock, verify } from 'ts-mockito';

import { AATesting } from '../../client/activation/aaTesting';
import { ExtensionActivationManager } from '../../client/activation/activationManager';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { DownloadBetaChannelRule, DownloadDailyChannelRule } from '../../client/activation/common/downloadChannelRules';
import { LanguageServerDownloader } from '../../client/activation/common/downloader';
import { LanguageServerDownloadChannel } from '../../client/activation/common/packageRepository';
import { ExtensionSurveyPrompt } from '../../client/activation/extensionSurvey';
import { JediExtensionActivator } from '../../client/activation/jedi';
import { DotNetLanguageServerActivator } from '../../client/activation/languageServer/activator';
import { LanguageServerAnalysisOptions } from '../../client/activation/languageServer/analysisOptions';
import { DotNetLanguageClientFactory } from '../../client/activation/languageServer/languageClientFactory';
import { LanguageServerCompatibilityService } from '../../client/activation/languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from '../../client/activation/languageServer/languageServerExtension';
import { DotNetLanguageServerFolderService } from '../../client/activation/languageServer/languageServerFolderService';
import {
    BetaDotNetLanguageServerPackageRepository,
    DailyDotNetLanguageServerPackageRepository,
    StableDotNetLanguageServerPackageRepository
} from '../../client/activation/languageServer/languageServerPackageRepository';
import { DotNetLanguageServerPackageService } from '../../client/activation/languageServer/languageServerPackageService';
import { DotNetLanguageServerProxy } from '../../client/activation/languageServer/languageServerProxy';
import { DotNetLanguageServerManager } from '../../client/activation/languageServer/manager';
import { LanguageServerOutputChannel } from '../../client/activation/languageServer/outputChannel';
import { PlatformData } from '../../client/activation/languageServer/platformData';
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
    LanguageServerType
} from '../../client/activation/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { IActiveResourceService } from '../../client/common/application/types';
import { INugetRepository } from '../../client/common/nuget/types';
import {
    BANNER_NAME_DS_SURVEY,
    BANNER_NAME_INTERACTIVE_SHIFTENTER,
    BANNER_NAME_LS_SURVEY,
    BANNER_NAME_PROPOSE_LS,
    IPythonExtensionBanner
} from '../../client/common/types';
import { DataScienceSurveyBanner } from '../../client/datascience/dataScienceSurveyBanner';
import { InteractiveShiftEnterBanner } from '../../client/datascience/shiftEnterBanner';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { LanguageServerSurveyBanner } from '../../client/languageServices/languageServerSurveyBanner';
import { ProposeLanguageServerBanner } from '../../client/languageServices/proposeLanguageServerBanner';

// tslint:disable:max-func-body-length

suite('Unit Tests - Language Server Activation Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    // tslint:disable-next-line: max-func-body-length
    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager), LanguageServerType.Microsoft);

        verify(
            serviceManager.addSingleton<ILanguageServerCache>(
                ILanguageServerCache,
                LanguageServerExtensionActivationService
            )
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension)
        ).once();
        verify(
            serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager)
        ).once();
        verify(
            serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                JediExtensionActivator,
                LanguageServerType.Jedi
            )
        ).once();
        verify(
            serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                DotNetLanguageServerActivator,
                LanguageServerType.Microsoft
            )
        ).once();
        verify(
            serviceManager.addSingleton<IPythonExtensionBanner>(
                IPythonExtensionBanner,
                LanguageServerSurveyBanner,
                BANNER_NAME_LS_SURVEY
            )
        ).once();
        verify(
            serviceManager.addSingleton<IPythonExtensionBanner>(
                IPythonExtensionBanner,
                ProposeLanguageServerBanner,
                BANNER_NAME_PROPOSE_LS
            )
        ).once();
        verify(
            serviceManager.addSingleton<IPythonExtensionBanner>(
                IPythonExtensionBanner,
                DataScienceSurveyBanner,
                BANNER_NAME_DS_SURVEY
            )
        ).once();
        verify(
            serviceManager.addSingleton<IPythonExtensionBanner>(
                IPythonExtensionBanner,
                InteractiveShiftEnterBanner,
                BANNER_NAME_INTERACTIVE_SHIFTENTER
            )
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerFolderService>(
                ILanguageServerFolderService,
                DotNetLanguageServerFolderService
            )
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerPackageService>(
                ILanguageServerPackageService,
                DotNetLanguageServerPackageService
            )
        ).once();
        verify(
            serviceManager.addSingleton<INugetRepository>(
                INugetRepository,
                StableDotNetLanguageServerPackageRepository,
                LanguageServerDownloadChannel.stable
            )
        ).once();
        verify(
            serviceManager.addSingleton<INugetRepository>(
                INugetRepository,
                BetaDotNetLanguageServerPackageRepository,
                LanguageServerDownloadChannel.beta
            )
        ).once();
        verify(
            serviceManager.addSingleton<INugetRepository>(
                INugetRepository,
                DailyDotNetLanguageServerPackageRepository,
                LanguageServerDownloadChannel.daily
            )
        ).once();
        verify(
            serviceManager.addSingleton<IDownloadChannelRule>(
                IDownloadChannelRule,
                DownloadDailyChannelRule,
                LanguageServerDownloadChannel.daily
            )
        ).once();
        verify(
            serviceManager.addSingleton<IDownloadChannelRule>(
                IDownloadChannelRule,
                DownloadBetaChannelRule,
                LanguageServerDownloadChannel.beta
            )
        ).once();
        verify(
            serviceManager.addSingleton<IDownloadChannelRule>(
                IDownloadChannelRule,
                DownloadBetaChannelRule,
                LanguageServerDownloadChannel.stable
            )
        ).once();
        verify(
            serviceManager.addSingleton<ILanagueServerCompatibilityService>(
                ILanagueServerCompatibilityService,
                LanguageServerCompatibilityService
            )
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DotNetLanguageClientFactory)
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader)
        ).once();
        verify(serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData)).once();
        verify(
            serviceManager.add<ILanguageServerAnalysisOptions>(
                ILanguageServerAnalysisOptions,
                LanguageServerAnalysisOptions
            )
        ).once();
        verify(serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, DotNetLanguageServerProxy)).once();
        verify(serviceManager.add<ILanguageServerManager>(ILanguageServerManager, DotNetLanguageServerManager)).once();
        verify(
            serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, AATesting)
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerOutputChannel>(
                ILanguageServerOutputChannel,
                LanguageServerOutputChannel
            )
        ).once();
        verify(
            serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService)
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionSingleActivationService>(
                IExtensionSingleActivationService,
                ExtensionSurveyPrompt
            )
        ).once();
    });
});
