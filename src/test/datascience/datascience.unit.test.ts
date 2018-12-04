// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as TypeMoq from 'typemoq';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { IConfigurationService, IDisposableRegistry, IExtensionContext } from '../../client/common/types';
import { DataScience } from '../../client/datascience/datascience';
import { IDataScience, IDataScienceCodeLensProvider } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Data Science Tests', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let shell: TypeMoq.IMock<IApplicationShell>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let disposableRegistry: TypeMoq.IMock<IDisposableRegistry>;
    let extensionContext: TypeMoq.IMock<IExtensionContext>;
    let codeLensProvider: TypeMoq.IMock<IDataScienceCodeLensProvider>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let dataScience: IDataScience;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        disposableRegistry = TypeMoq.Mock.ofType<IDisposableRegistry>();
        shell = TypeMoq.Mock.ofType<IApplicationShell>();
        extensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        codeLensProvider = TypeMoq.Mock.ofType<IDataScienceCodeLensProvider>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        dataScience = new DataScience(
            serviceContainer.object,
            commandManager.object,
            disposableRegistry.object,
            extensionContext.object,
            codeLensProvider.object,
            configurationService.object,
            documentManager.object,
            shell.object);
    });
});
