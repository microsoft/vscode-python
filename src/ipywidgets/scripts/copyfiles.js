// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const fs = require('fs');
const outputDir = path.join(__dirname, '..', '..', '..', 'out/ipywidgets');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}
fs.copyFileSync(path.join(__dirname, '../src/widgets.css'), path.join(outputDir, 'widgets.css'));
