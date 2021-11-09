// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { ExtensionActivationManager } from './activationManager';
import { LanguageServerExtensionActivationService } from './activationService';
import { ExtensionSurveyPrompt } from './extensionSurvey';
import { JediLanguageServerAnalysisOptions } from './jedi/analysisOptions';
import { JediLanguageClientFactory } from './jedi/languageClientFactory';
import { JediLanguageServerProxy } from './jedi/languageServerProxy';
import { JediLanguageServerManager } from './jedi/manager';
import { LanguageServerOutputChannel } from './common/outputChannel';
import { NodeLanguageServerActivator } from './node/activator';
import { NodeLanguageServerAnalysisOptions } from './node/analysisOptions';
import { NodeLanguageClientFactory } from './node/languageClientFactory';
import { NodeLanguageServerFolderService } from './node/languageServerFolderService';
import { NodeLanguageServerProxy } from './node/languageServerProxy';
import { NodeLanguageServerManager } from './node/manager';
import { NoLanguageServerExtensionActivator } from './none/activator';
import {
    IExtensionActivationManager,
    IExtensionActivationService,
    IExtensionSingleActivationService,
    ILanguageClientFactory,
    ILanguageServerActivator,
    ILanguageServerAnalysisOptions,
    ILanguageServerCache,
    ILanguageServerFolderService,
    ILanguageServerManager,
    ILanguageServerOutputChannel,
    ILanguageServerProxy,
    LanguageServerType,
} from './types';
import { JediLanguageServerActivator } from './jedi/activator';
import { LoadLanguageServerExtension } from './common/loadLanguageServerExtension';

export function registerTypes(serviceManager: IServiceManager, languageServerType: LanguageServerType): void {
    serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService);
    serviceManager.addBinding(ILanguageServerCache, IExtensionActivationService);
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.add<ILanguageServerActivator>(
        ILanguageServerActivator,
        NoLanguageServerExtensionActivator,
        LanguageServerType.None,
    );
    serviceManager.addSingleton<ILanguageServerOutputChannel>(
        ILanguageServerOutputChannel,
        LanguageServerOutputChannel,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ExtensionSurveyPrompt,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        LoadLanguageServerExtension,
    );

    if (languageServerType === LanguageServerType.Node) {
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
}
