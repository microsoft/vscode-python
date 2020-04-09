// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Register the azureaml widget with requirejs.
// This way the Azure ML file will be loaded dynamically when requested.
if (window.requirejs === undefined) {
    throw new Error('Requirejs is needed, please ensure it is loaded on the page.');
}

// When bundled in extension, `window.__PVSC_Public_Path` window contain the VSC Uri.
// We need this because VSC doesn't allow loading any arbitrary files from disc (only those with a specific Uri format).
const conf = {
    paths: {
        azureml_widgets: (window.__PVSC_Public_Path || '') + 'azuremlindex'
    }
};
window.requirejs.config(conf);
