// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { IWebPanelProvider } from '../application/types';
import { WebPanelProvider } from '../application/webPanelProvider';
import { ProductType } from '../types';
import { InstallationChannelManager } from './channelManager';
import { CondaInstaller } from './condaInstaller';
import { PipEnvInstaller } from './pipEnvInstaller';
import { PipInstaller } from './pipInstaller';
import { PoetryInstaller } from './poetryInstaller';
import { CTagsProductPathService, DataScienceProductPathService, FormatterProductPathService, LinterProductPathService, RefactoringLibraryProductPathService, TestFrameworkProductPathService } from './productPath';
import { ProductService } from './productService';
import { IInstallationChannelManager, IModuleInstaller, IProductPathService, IProductService, IExtensionInstaller } from './types';
import { ExtensionInstaller } from './extensionInstaller';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipEnvInstaller);
    serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PoetryInstaller);
    serviceManager.addSingleton<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);
    serviceManager.addSingleton<IExtensionInstaller>(IExtensionInstaller, ExtensionInstaller);

    serviceManager.addSingleton<IProductService>(IProductService, ProductService);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
    serviceManager.addSingleton<IProductPathService>(IProductPathService, DataScienceProductPathService, ProductType.DataScience);
    serviceManager.addSingleton<IWebPanelProvider>(IWebPanelProvider, WebPanelProvider);
}
