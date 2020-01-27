// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Note to editors, if you change this file you have to restart compile-webviews.
// It doesn't reload the config otherwise.
const builder = require('./webpack.datascience-ui.config.builder');
const depedencyBuilder = require('./webpack.datascience-ui.dependency.config.builder');
module.exports = [...depedencyBuilder, builder.nativeEditorConfig, builder.plotViewerConfig];
