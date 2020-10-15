// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IWebviewPanelProvider } from '../../../client/common/application/types';
import { WebviewPanelProvider } from '../../../client/common/application/webviewPanels/webviewPanelProvider';
import { InstallationChannelManager } from '../../../client/common/installer/channelManager';
import { CondaInstaller } from '../../../client/common/installer/condaInstaller';
import { InsidersBuildInstaller, StableBuildInstaller } from '../../../client/common/installer/extensionBuildInstaller';
import { PipEnvInstaller } from '../../../client/common/installer/pipEnvInstaller';
import { PipInstaller } from '../../../client/common/installer/pipInstaller';
import { PoetryInstaller } from '../../../client/common/installer/poetryInstaller';
import {
    CTagsProductPathService,
    DataScienceProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService
} from '../../../client/common/installer/productPath';
import { ProductService } from '../../../client/common/installer/productService';
import { registerTypes } from '../../../client/common/installer/serviceRegistry';
import {
    IExtensionBuildInstaller,
    IInstallationChannelManager,
    IModuleInstaller,
    INSIDERS_INSTALLER,
    IProductPathService,
    IProductService,
    STABLE_INSTALLER
} from '../../../client/common/installer/types';
import { ProductType } from '../../../client/common/types';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceManager } from '../../../client/ioc/types';

suite('Common installer Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));
        verify(serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller)).once();
        verify(serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller)).once();
        verify(serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipEnvInstaller)).once();
        verify(serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PoetryInstaller)).once();
        verify(
            serviceManager.addSingleton<IInstallationChannelManager>(
                IInstallationChannelManager,
                InstallationChannelManager
            )
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionBuildInstaller>(
                IExtensionBuildInstaller,
                StableBuildInstaller,
                STABLE_INSTALLER
            )
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionBuildInstaller>(
                IExtensionBuildInstaller,
                InsidersBuildInstaller,
                INSIDERS_INSTALLER
            )
        ).once();

        verify(serviceManager.addSingleton<IProductService>(IProductService, ProductService)).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                CTagsProductPathService,
                ProductType.WorkspaceSymbols
            )
        ).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                FormatterProductPathService,
                ProductType.Formatter
            )
        ).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                LinterProductPathService,
                ProductType.Linter
            )
        ).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                TestFrameworkProductPathService,
                ProductType.TestFramework
            )
        ).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                RefactoringLibraryProductPathService,
                ProductType.RefactoringLibrary
            )
        ).once();
        verify(
            serviceManager.addSingleton<IProductPathService>(
                IProductPathService,
                DataScienceProductPathService,
                ProductType.DataScience
            )
        ).once();
        verify(serviceManager.addSingleton<IWebviewPanelProvider>(IWebviewPanelProvider, WebviewPanelProvider)).once();
    });
});
