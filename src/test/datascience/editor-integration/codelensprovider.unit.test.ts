// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { TextDocument } from 'vscode';
import { IConfigurationService, IPythonSettings, IDataScienceSettings } from '../../../client/common/types';
import { IDataScienceCodeLensProvider } from '../../../client/datascience/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { DataScienceCodeLensProvider } from '../../../client/datascience/editor-integration/codelensprovider';

suite('DataScienceCodeLensProvider Unit Tests', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let codeLensProvider: IDataScienceCodeLensProvider;
    let dataScienceSettings: TypeMoq.IMock<IDataScienceSettings>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();

        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
        dataScienceSettings.setup(d => d.enabled).returns(() => true);
        pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        codeLensProvider = new DataScienceCodeLensProvider(serviceContainer.object, configurationService.object);
    });

    test('Initialize Code Lenses', () => {
        const document = TypeMoq.Mock.ofType<TextDocument>();
        document.setup(d => d.fileName).returns(() => 'test.py');
        document.setup(d => d.version).returns(() => 1);
        codeLensProvider.provideCodeLenses(document.object, undefined);
    });
});