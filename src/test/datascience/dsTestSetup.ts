// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
/**
 * Modify package.json to ensure VSC Notebooks have been setup so tests can run.
 * This is required because we modify package.json during runtime, hence we need to do the same thing for tests.
 */

const packageJsonFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'package.json');
const content = JSON.parse(fs.readFileSync(packageJsonFile).toString());

// This code is temporary.
if (
    !content.enableProposedApi ||
    !Array.isArray(content.contributes.notebookOutputRenderer) ||
    !Array.isArray(content.contributes.notebookProvider)
) {
    content.enableProposedApi = true;
    content.contributes.notebookOutputRenderer = [
        {
            viewType: 'jupyter-notebook-renderer',
            displayName: 'Jupyter Notebook Renderer',
            mimeTypes: [
                'application/geo+json',
                'application/vdom.v1+json',
                'application/vnd.dataresource+json',
                'application/vnd.plotly.v1+json',
                'application/vnd.vega.v2+json',
                'application/vnd.vega.v3+json',
                'application/vnd.vega.v4+json',
                'application/vnd.vega.v5+json',
                'application/vnd.vegalite.v1+json',
                'application/vnd.vegalite.v2+json',
                'application/vnd.vegalite.v3+json',
                'application/vnd.vegalite.v4+json',
                'application/x-nteract-model-debug+json',
                'image/gif',
                'text/latex',
                'text/vnd.plotly.v1+html'
            ]
        }
    ];
    content.contributes.notebookProvider = [
        {
            viewType: 'jupyter-notebook',
            displayName: 'Jupyter Notebook',
            selector: [
                {
                    filenamePattern: '*.ipynb'
                }
            ]
        }
    ];
}

// Update package.json to pick experiments from our custom settings.json file.
content.contributes.configuration.properties['python.experiments.optInto'].scope = 'resource';

fs.writeFileSync(packageJsonFile, JSON.stringify(content, undefined, 4));
