// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const fs = require('fs');
const outputDir = path.join(__dirname, '..', '..', '..', 'out/ipywidgets');
const azureMLDir = path.join(outputDir, 'azureml');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}
if (!fs.existsSync(azureMLDir)) {
    fs.mkdirSync(azureMLDir);
}
fs.copyFileSync(path.join(__dirname, '../src/widgets.css'), path.join(outputDir, 'widgets.css'));
fs.copyFileSync(path.join(__dirname, '../src/azureml/index.js'), path.join(azureMLDir, 'index.js'));
fs.copyFileSync(path.join(__dirname, '../src/azureml/extension.js'), path.join(azureMLDir, 'extension.js'));
