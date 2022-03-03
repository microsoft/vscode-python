// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { instance, mock, verify } from 'ts-mockito';

import { ExtensionActivationManager } from '../../client/activation/activationManager';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { ExtensionSurveyPrompt } from '../../client/activation/extensionSurvey';
import { LanguageServerOutputChannel } from '../../client/activation/common/outputChannel';
import { NoLanguageServerExtensionActivator } from '../../client/activation/none/activator';
import { registerTypes } from '../../client/activation/serviceRegistry';
import {
    IExtensionActivationManager,
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
} from '../../client/activation/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { NodeLanguageServerActivator } from '../../client/activation/node/activator';
import { NodeLanguageServerAnalysisOptions } from '../../client/activation/node/analysisOptions';
import { NodeLanguageClientFactory } from '../../client/activation/node/languageClientFactory';
import { NodeLanguageServerFolderService } from '../../client/activation/node/languageServerFolderService';
import { NodeLanguageServerProxy } from '../../client/activation/node/languageServerProxy';
import { NodeLanguageServerManager } from '../../client/activation/node/manager';
import { JediLanguageServerActivator } from '../../client/activation/jedi/activator';
import { JediLanguageServerAnalysisOptions } from '../../client/activation/jedi/analysisOptions';
import { JediLanguageClientFactory } from '../../client/activation/jedi/languageClientFactory';
import { JediLanguageServerProxy } from '../../client/activation/jedi/languageServerProxy';
import { JediLanguageServerManager } from '../../client/activation/jedi/manager';
import { LoadLanguageServerExtension } from '../../client/activation/common/loadLanguageServerExtension';

suite('Unit Tests - Language Server Activation Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    function verifyCommon() {
        verify(
            serviceManager.addSingleton<ILanguageServerCache>(
                ILanguageServerCache,
                LanguageServerExtensionActivationService,
            ),
        ).once();
        verify(
            serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager),
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageServerOutputChannel>(
                ILanguageServerOutputChannel,
                LanguageServerOutputChannel,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionSingleActivationService>(
                IExtensionSingleActivationService,
                ExtensionSurveyPrompt,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionSingleActivationService>(
                IExtensionSingleActivationService,
                LoadLanguageServerExtension,
            ),
        ).once();
        verify(
            serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                NoLanguageServerExtensionActivator,
                LanguageServerType.None,
            ),
        ).once();
    }

    test('Ensure services are registered: Node', async () => {
        registerTypes(instance(serviceManager), LanguageServerType.Node);

        verifyCommon();

        verify(
            serviceManager.add<ILanguageServerAnalysisOptions>(
                ILanguageServerAnalysisOptions,
                NodeLanguageServerAnalysisOptions,
                LanguageServerType.Node,
            ),
        ).once();
        verify(
            serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                NodeLanguageServerActivator,
                LanguageServerType.Node,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, NodeLanguageClientFactory),
        ).once();
        verify(serviceManager.add<ILanguageServerManager>(ILanguageServerManager, NodeLanguageServerManager)).once();
        verify(serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, NodeLanguageServerProxy)).once();
        verify(
            serviceManager.addSingleton<ILanguageServerFolderService>(
                ILanguageServerFolderService,
                NodeLanguageServerFolderService,
            ),
        ).once();
    });
    test('Ensure services are registered: Jedi', async () => {
        registerTypes(instance(serviceManager), LanguageServerType.Jedi);

        verifyCommon();

        verify(
            serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                JediLanguageServerActivator,
                LanguageServerType.Jedi,
            ),
        ).once();

        verify(
            serviceManager.add<ILanguageServerAnalysisOptions>(
                ILanguageServerAnalysisOptions,
                JediLanguageServerAnalysisOptions,
                LanguageServerType.Jedi,
            ),
        ).once();

        verify(
            serviceManager.addSingleton<ILanguageClientFactory>(ILanguageClientFactory, JediLanguageClientFactory),
        ).once();
        verify(serviceManager.add<ILanguageServerManager>(ILanguageServerManager, JediLanguageServerManager)).once();
        verify(serviceManager.add<ILanguageServerProxy>(ILanguageServerProxy, JediLanguageServerProxy)).once();
    });
});
