// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');

fs.copyFileSync(path.resolve(__dirname, '..', 'dist', 'ipywidgets', 'ipywidgets.js'), path.resolve(__dirname, '..', '..', '..', 'out', 'datascience-ui', 'native-editor', 'ipywidgets.js'));
