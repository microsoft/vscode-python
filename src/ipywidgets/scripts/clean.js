// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const rimraf = require('rimraf');
const path = require('path');

rimraf.sync(path.join(__dirname, '..', '..', '..', 'out', 'ipywidgets'));
