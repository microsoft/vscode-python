// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';

import { IDocumentManager } from '../../../client/common/application/types';
import { IConfigurationService, IDataScienceSettings, IPythonSettings } from '../../../client/common/types';
import { CellHashProvider } from '../../../client/datascience/editor-integration/cellhashprovider';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-window/interactiveWindowTypes';
import { createDocument } from './helpers';

// tslint:disable-next-line: max-func-body-length
suite('CellHashProvider Unit Tests', () => {
    let hashProvider: CellHashProvider;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let dataScienceSettings: TypeMoq.IMock<IDataScienceSettings>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;

    setup(() => {
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
        dataScienceSettings.setup(d => d.enabled).returns(() => true);
        pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        hashProvider = new CellHashProvider(documentManager.object, configurationService.object);
    });

    test('Add a single cell', async () => {
        const code = '#%%\r\nprint("foo")';
        // Create our document
        const document = createDocument(code, 'foo.py', 4, TypeMoq.Times.atLeastOnce(), true);
        documentManager.setup(d => d.textDocuments).returns(() => [document.object]);

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 0 });

        // We should have a single hash
        const hashes = await hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 0, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 1, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
     });

});
