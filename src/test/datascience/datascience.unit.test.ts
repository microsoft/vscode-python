// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { IConfigurationService, IDisposableRegistry, IExtensionContext } from '../../client/common/types';
import { formatStreamText } from '../../client/datascience/common';
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

    test('formatting stream text', async () => {
        assert.equal(formatStreamText('\rExecute\rExecute 1'), 'Execute 1');
        assert.equal(formatStreamText('\rExecute\r\nExecute 2'), 'Execute\nExecute 2');
        assert.equal(formatStreamText('\rExecute\rExecute\r\nExecute 3'), 'Execute\nExecute 3');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 4'), 'Execute\nExecute 4');
        assert.equal(formatStreamText('\rExecute\r\r \r\rExecute\nExecute 5'), 'Execute\nExecute 5');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 6\rExecute 7'), 'Execute\nExecute 7');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 8\rExecute 9\r\r'), 'Execute\n');
        assert.equal(formatStreamText('\rExecute\rExecute\nExecute 10\rExecute 11\r\n'), 'Execute\nExecute 11\n');
    });

});
