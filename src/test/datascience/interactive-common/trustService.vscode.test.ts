// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { IConfigurationService, IDataScienceSettings, IDisposable } from '../../../client/common/types';
import { ITrustService } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { initialize } from '../../initialize';
import { createTemporaryNotebook, disposeAllDisposables } from '../notebook/helper';

suite('DataScience - TrustService', () => {
    let api: IExtensionTestApi;
    let trustService: ITrustService;
    let ipynbFile: string;
    let oldTrustSetting: boolean;
    let dsSettings: IDataScienceSettings | undefined;
    const templateIpynb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src/test/datascience/interactive-common/nbToTrust.ipynb'
    );
    const disposables: IDisposable[] = [];
    suiteSetup(async () => {
        api = await initialize();
        trustService = api.serviceContainer.get<ITrustService>(ITrustService);
        const configService = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        dsSettings = configService.getSettings().datascience;
        oldTrustSetting = dsSettings.alwaysTrustNotebooks;
        dsSettings.alwaysTrustNotebooks = false;
    });
    setup(async () => {
        // Don't use same file (else it might not work locally, as memento would have trusted this file previously).
        ipynbFile = await createTemporaryNotebook(templateIpynb, disposables);
    });
    teardown(() => disposeAllDisposables(disposables));
    suiteTeardown(() => {
        if (dsSettings) {
            dsSettings.alwaysTrustNotebooks = oldTrustSetting === true;
        }
    });
    test('Trusting a notebook', async () => {
        const uri = Uri.file(path.join(ipynbFile, uuid()));

        const contents = await fs.readFile(ipynbFile, { encoding: 'utf8' });
        assert.isFalse(await trustService.isNotebookTrusted(uri, contents), 'Notebook should not be trusted');

        await trustService.trustNotebook(uri, contents);
        assert.isTrue(await trustService.isNotebookTrusted(uri, contents), 'Notebook should be trusted');
    });
    test('Trusting a notebook (json saved with different formats)', async () => {
        const uri = Uri.file(path.join(ipynbFile, uuid()));
        const contents = await fs.readFile(ipynbFile, { encoding: 'utf8' });
        const contentsWithNoIndentation = JSON.stringify(JSON.parse(contents), undefined, '');

        await trustService.trustNotebook(uri, contentsWithNoIndentation);
        assert.isTrue(
            await trustService.isNotebookTrusted(uri, contentsWithNoIndentation),
            'Notebook should be trusted'
        );

        // Confirm the same json formatted with 2 & 4 spaces are considered trusted.
        const contentsWith2Indentation = JSON.stringify(JSON.parse(contents), undefined, 2);
        const contentsWith4Indentation = JSON.stringify(JSON.parse(contents), undefined, 4);
        assert.isTrue(
            await trustService.isNotebookTrusted(uri, contentsWith2Indentation),
            'Not trusted with 2 indents'
        );
        assert.isTrue(
            await trustService.isNotebookTrusted(uri, contentsWith4Indentation),
            'Not trusted with 4 indents'
        );
    });
});
