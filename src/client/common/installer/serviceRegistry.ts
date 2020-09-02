// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { IWebviewPanelProvider } from '../application/types';
import { WebviewPanelProvider } from '../application/webviewPanels/webviewPanelProvider';
import { ProductType } from '../types';
import { InstallationChannelManager } from './channelManager';
import { CondaInstaller } from './condaInstaller';
import { InsidersBuildInstaller, StableBuildInstaller } from './extensionBuildInstaller';
import { PipEnvInstaller } from './pipEnvInstaller';
import { PipInstaller } from './pipInstaller';
import { PoetryInstaller } from './poetryInstaller';
import {
    CTagsProductPathService,
    DataScienceProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService
} from './productPath';
import { ProductService } from './productService';
import {
    IExtensionBuildInstaller,
    IInstallationChannelManager,
    IModuleInstaller,
    INSIDERS_INSTALLER,
    IProductPathService,
    IProductService,
    STABLE_INSTALLER
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipEnvInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PoetryInstaller);
    serviceManager.addSingleton<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);
    serviceManager.addSingleton<IExtensionBuildInstaller>(
        IExtensionBuildInstaller,
        StableBuildInstaller,
        STABLE_INSTALLER
    );
    serviceManager.addSingleton<IExtensionBuildInstaller>(
        IExtensionBuildInstaller,
        InsidersBuildInstaller,
        INSIDERS_INSTALLER
    );

    serviceManager.addSingleton<IProductService>(IProductService, ProductService);
    serviceManager.addSingleton<IProductPathService>(
        IProductPathService,
        CTagsProductPathService,
        ProductType.WorkspaceSymbols
    );
    serviceManager.addSingleton<IProductPathService>(
        IProductPathService,
        FormatterProductPathService,
        ProductType.Formatter
    );
    serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
    serviceManager.addSingleton<IProductPathService>(
        IProductPathService,
        TestFrameworkProductPathService,
        ProductType.TestFramework
    );
    serviceManager.addSingleton<IProductPathService>(
        IProductPathService,
        RefactoringLibraryProductPathService,
        ProductType.RefactoringLibrary
    );
    serviceManager.addSingleton<IProductPathService>(
        IProductPathService,
        DataScienceProductPathService,
        ProductType.DataScience
    );
    serviceManager.addSingleton<IWebviewPanelProvider>(IWebviewPanelProvider, WebviewPanelProvider);
}
