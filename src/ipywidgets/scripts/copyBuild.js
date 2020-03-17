// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');

const ipywidgetsFile = path.resolve(__dirname, '..', 'dist', 'ipywidgets', 'ipywidgets.js');

const limembedAmdFile = path.resolve(__dirname, '..', 'dist', 'lib', 'amd', 'libembed-amd.js');
const limembedAmdFileContents = fs.readFileSync(limembedAmdFile, {encoding: 'utf8'}).toString();

const limembedAmdRendererFile = path.resolve(__dirname, '..', 'dist', 'lib', 'amd', 'embed-amd-render.js');
const limembedAmdRendererFileContents = fs.readFileSync(limembedAmdRendererFile, {encoding: 'utf8'}).toString();

fs.appendFileSync(ipywidgetsFile, `\n\n\n\n\n//(VS Code Python) Injected libembed-amd.js contents\n\n\n${limembedAmdFileContents}`);
fs.appendFileSync(ipywidgetsFile, `\n\n\n\n\n//(VS Code Python) Injected embed-amd-render.js contents\n\n\n${limembedAmdRendererFileContents}`);
fs.copyFileSync(path.resolve(__dirname, '..', 'dist', 'ipywidgets', 'ipywidgets.js'), path.resolve(__dirname, '..', '..', '..', 'out', 'datascience-ui', 'notebook', 'ipywidgets.js'));
