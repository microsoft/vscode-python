// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const constants = require('../../constants');
const nodeFetchIndex = path.join(constants.ExtensionRootDir, 'node_modules', '@jupyterlab','services','node_modules','node-fetch','lib','index.js');

/**
 * Node fetch has an es6 module file. That gets bundled into @jupyterlab/services.
 * However @jupyterlab/services/serverconnection.js is written such that it uses fetch from either node or browser.
 * We need to force the browser version for things to work correctly.
 *
 * @export
 * @param {string} source
 * @returns
 */
exports.default = function (source) {
    if (source.indexOf('require(\'node-fetch\')') > 0) {
        source = source.replace(/require\('node-fetch'\)/g, `require('${nodeFetchIndex}')`);
    }
    return source;
}
