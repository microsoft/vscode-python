// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');

const ipywidgetsOutputFolder = path.resolve(__dirname, '..', '..', '..', 'out', 'ipywidgets');
const ipywidgetsFile = path.resolve(ipywidgetsOutputFolder, 'dist', 'ipywidgets.js');

const limembedAmdFile = path.resolve(ipywidgetsOutputFolder, 'dist', 'lib', 'amd', 'libembed-amd.js');
const limembedAmdFileContents = fs.readFileSync(limembedAmdFile, { encoding: 'utf8' }).toString();

const limembedAmdRendererFile = path.resolve(ipywidgetsOutputFolder, 'dist', 'lib', 'amd', 'embed-amd-render.js');
const limembedAmdRendererFileContents = fs.readFileSync(limembedAmdRendererFile, { encoding: 'utf8' }).toString();

// We need a single file that contains output from ipywidgets.js, libembed-amd.js and embed-amd-render.js.

fs.appendFileSync(
    ipywidgetsFile,
    `\n\n\n\n\n//(VS Code Python) Injected libembed-amd.js contents\n\n\n${limembedAmdFileContents}`
);
fs.appendFileSync(
    ipywidgetsFile,
    `\n\n\n\n\n//(VS Code Python) Injected embed-amd-render.js contents\n\n\n${limembedAmdRendererFileContents}`
);
