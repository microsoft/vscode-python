// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { ITrustService } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { initialize } from '../../initialize';

suite('DataScience - TrustService', () => {
    let api: IExtensionTestApi;
    let trustService: ITrustService;
    const templateIpynb = Uri.file(
        path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src/test/datascience/interactive-common/nbToTrust.ipynb')
    );
    suiteSetup(async () => {
        api = await initialize();
        trustService = api.serviceContainer.get<ITrustService>(ITrustService);
    });

    test('Trusting a notebook', async () => {
        const uri = Uri.file(path.join(templateIpynb.fsPath, uuid()));

        const contents = await fs.readFile(templateIpynb.fsPath, { encoding: 'utf8' });
        assert.isFalse(await trustService.isNotebookTrusted(uri, contents), 'Notebook is not trusted');

        await trustService.trustNotebook(uri, contents);
        assert.isTrue(await trustService.isNotebookTrusted(uri, contents), 'Notebook is not trusted');
    });
    test('Trusting a notebook (json saved with different formats)', async () => {
        const uri = Uri.file(path.join(templateIpynb.fsPath, uuid()));
        const contents = await fs.readFile(templateIpynb.fsPath, { encoding: 'utf8' });
        const contentsWithNoIndentation = JSON.stringify(JSON.parse(contents), undefined, '');

        await trustService.trustNotebook(uri, contentsWithNoIndentation);
        assert.isTrue(await trustService.isNotebookTrusted(uri, contentsWithNoIndentation), 'Notebook is not trusted');

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
