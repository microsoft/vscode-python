// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { registerTypes as registerDotNetTypes } from '../common/dotnet/serviceRegistry';
import { INugetRepository } from '../common/nuget/types';
import { IServiceManager } from '../ioc/types';
import { ExtensionActivationManager } from './activationManager';
import { LanguageServerExtensionActivationService } from './activationService';
import { DownloadBetaChannelRule, DownloadDailyChannelRule } from './common/downloadChannelRules';
import { LanguageServerDownloader } from './common/downloader';
import { LanguageServerDownloadChannel } from './common/packageRepository';
import { ExtensionSurveyPrompt } from './extensionSurvey';
import { JediLanguageServerAnalysisOptions } from './jedi/analysisOptions';
import { JediLanguageClientFactory } from './jedi/languageClientFactory';
import { JediLanguageServerProxy } from './jedi/languageServerProxy';
import { JediLanguageServerManager } from './jedi/manager';
import { DotNetLanguageServerActivator } from './languageServer/activator';
import { DotNetLanguageServerAnalysisOptions } from './languageServer/analysisOptions';
import { DotNetLanguageClientFactory } from './languageServer/languageClientFactory';
import { LanguageServerCompatibilityService } from './languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from './languageServer/languageServerExtension';
import { DotNetLanguageServerFolderService } from './languageServer/languageServerFolderService';
import {
    BetaDotNetLanguageServerPackageRepository,
    DailyDotNetLanguageServerPackageRepository,
    StableDotNetLanguageServerPackageRepository,
} from './languageServer/languageServerPackageRepository';
import { DotNetLanguageServerPackageService } from './languageServer/languageServerPackageService';
import { DotNetLanguageServerProxy } from './languageServer/languageServerProxy';
import { DotNetLanguageServerManager } from './languageServer/manager';
import { LanguageServerOutputChannel } from './languageServer/outputChannel';
import { PlatformData } from './languageServer/platformData';
import { NodeLanguageServerActivator } from './node/activator';
import { NodeLanguageServerAnalysisOptions } from './node/analysisOptions';
import { NodeLanguageClientFactory } from './node/languageClientFactory';
import { NodeLanguageServerFolderService } from './node/languageServerFolderService';
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
    ILanguageServerCompatibilityService,
    ILanguageServerDownloader,
    ILanguageServerExtension,
    ILanguageServerFolderService,
    ILanguageServerManager,
    ILanguageServerOutputChannel,
    ILanguageServerPackageService,
    ILanguageServerProxy,
    IMPLSDeprecationPrompt,
    IPlatformData,
    LanguageServerType,
} from './types';
import { JediLanguageServerActivator } from './jedi/activator';
import { MPLSDeprecationPrompt } from './languageServer/deprecationPrompt';

export function registerTypes(serviceManager: IServiceManager, languageServerType: LanguageServerType): void {
    serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService);
    serviceManager.addBinding(ILanguageServerCache, IExtensionActivationService);
    serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);

    if (languageServerType === LanguageServerType.Microsoft) {
        serviceManager.addSingleton<IMPLSDeprecationPrompt>(IMPLSDeprecationPrompt, MPLSDeprecationPrompt);
        serviceManager.add<ILanguageServerAnalysisOptions>(
            ILanguageServerAnalysisOptions,
            DotNetLanguageServerAnalysisOptions,
            LanguageServerType.Microsoft,
        );
        serviceManager.add<ILanguageServerActivator>(
            ILanguageServerActivator,
            DotNetLanguageServerActivator,
            LanguageServerType.Microsoft,
        );
        serviceManager.addSingleton<INugetRepository>(
            INugetRepository,
            StableDotNetLanguageServerPackageRepository,
            LanguageServerDownloadChannel.stable,
        );
        serviceManager.addSingleton<INugetRepository>(
            INugetRepository,
            BetaDotNetLanguageServerPackageRepository,
            LanguageServerDownloadChannel.beta,
        );
        serviceManager.addSingleton<INugetRepository>(
            INugetRepository,
            DailyDotNetLanguageServerPackageRepository,
            LanguageServerDownloadChannel.daily,
        );
        serviceManager.addSingleton<ILanguageServerCompatibilityService>(
            ILanguageServerCompatibilityService,
            LanguageServerCompatibilityService,
        );
        serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, DotNetLanguageClientFactory);
        serviceManager.addSingleton<IPlatformData>(IPlatformData, PlatformData);
        serviceManager.add<ILanguageServerManager>(ILanguageServerManager, DotNetLanguageServerManager);
        serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, DotNetLanguageServerProxy);
        serviceManager.addSingleton<ILanguageServerFolderService>(
            ILanguageServerFolderService,
            DotNetLanguageServerFolderService,
        );
        serviceManager.addSingleton<ILanguageServerPackageService>(
            ILanguageServerPackageService,
            DotNetLanguageServerPackageService,
        );
        registerDotNetTypes(serviceManager);
    } else if (languageServerType === LanguageServerType.Node) {
        serviceManager.add<ILanguageServerAnalysisOptions>(
            ILanguageServerAnalysisOptions,
            NodeLanguageServerAnalysisOptions,
            LanguageServerType.Node,
        );
        serviceManager.add<ILanguageServerActivator>(
            ILanguageServerActivator,
            NodeLanguageServerActivator,
            LanguageServerType.Node,
        );
        serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, NodeLanguageClientFactory);
        serviceManager.add<ILanguageServerManager>(ILanguageServerManager, NodeLanguageServerManager);
        serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, NodeLanguageServerProxy);
        serviceManager.addSingleton<ILanguageServerFolderService>(
            ILanguageServerFolderService,
            NodeLanguageServerFolderService,
        );
    } else if (languageServerType === LanguageServerType.Jedi) {
        serviceManager.add<ILanguageServerActivator>(
            ILanguageServerActivator,
            JediLanguageServerActivator,
            LanguageServerType.Jedi,
        );

        serviceManager.add<ILanguageServerAnalysisOptions>(
            ILanguageServerAnalysisOptions,
            JediLanguageServerAnalysisOptions,
            LanguageServerType.Jedi,
        );

        serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, JediLanguageClientFactory);
        serviceManager.add<ILanguageServerManager>(ILanguageServerManager, JediLanguageServerManager);
        serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, JediLanguageServerProxy);
    }

    serviceManager.add<ILanguageServerActivator>(
        ILanguageServerActivator,
        NoLanguageServerExtensionActivator,
        LanguageServerType.None,
    );

    serviceManager.addSingleton<IDownloadChannelRule>(
        IDownloadChannelRule,
        DownloadDailyChannelRule,
        LanguageServerDownloadChannel.daily,
    );
    serviceManager.addSingleton<IDownloadChannelRule>(
        IDownloadChannelRule,
        DownloadBetaChannelRule,
        LanguageServerDownloadChannel.beta,
    );
    serviceManager.addSingleton<IDownloadChannelRule>(
        IDownloadChannelRule,
        DownloadBetaChannelRule,
        LanguageServerDownloadChannel.stable,
    );
    serviceManager.addSingleton<ILanguageServerDownloader>(ILanguageServerDownloader, LanguageServerDownloader);

    serviceManager.addSingleton<ILanguageServerOutputChannel>(
        ILanguageServerOutputChannel,
        LanguageServerOutputChannel,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ExtensionSurveyPrompt,
    );
}
