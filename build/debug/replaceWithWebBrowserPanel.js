// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const fs = require('fs-extra');
const common = require('../constants');

// Used to debug extension with the DS UI loaded in a web browser.
// We don't want to include test code into extension, hence just patch the js code for debugging.
// This code is used in fucntional ui tests.

const fileToModify = path.join(common.ExtensionRootDir, 'out/client/common/installer/serviceRegistry.js');
const fileContents = fs.readFileSync(fileToModify).toString();

const newInjection = 'require("../../../test/datascience/uiTests/webBrowserPanelProvider").WebBrowserPanelProvider';
const oldInjection = 'webPanelProvider_1.WebPanelProvider';

if (fileContents.indexOf(oldInjection) === -1 && fileContents.indexOf(newInjection) === -1) {
    throw new Error('Unable to modify serviceRegistry.js for WebBrowser debugging');
}
if (fileContents.indexOf(oldInjection)) {
    const newFileContents = fileContents.replace(oldInjection, newInjection);
    fs.writeFileSync(fileToModify, newFileContents);
}
