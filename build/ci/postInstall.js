// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const colors = require("colors/safe");
const fs = require("fs");
const path = require("path");
const constants = require("../constants");

/**
 * In order to compile the extension in strict mode, one of the dependencies (@jupyterlab) has some files that
 * just won't compile in strict mode.
 * Unfortunately we cannot fix it by overriding their type definitions
 * Note: that has been done for a few of the JupyterLabl files (see typings/index.d.ts).
 * The solution is to modify the type definition file after `npm install`.
 */
function fixJupyterLabDTSFiles() {
    const relativePath = path.join('node_modules', '@jupyterlab', 'coreutils', 'lib', 'settingregistry.d.ts');
    const filePath = path.join(constants.ExtensionRootDir, relativePath);
    if (!fs.existsSync(filePath)) {
        throw new Error("Type Definition file from JupyterLab not found '" + filePath + "' (pvsc post install script)");
    }
    var fileContents = fs.readFileSync(filePath, { encoding: 'utf8' });
    let updated = false;
    if (fileContents.indexOf('[key: string]: ISchema;') > 0) {
        updated = true;
        fileContents = fileContents.replace('[key: string]: ISchema;', '[key: string]: ISchema | undefined;');
    }
    if (fileContents.indexOf('\'jupyter.lab.setting-icon-class\'?: ISchema;') > 0) {
        updated = true;
        fileContents = fileContents.replace('\'jupyter.lab.setting-icon-class\'?: ISchema;', '');
    }
    if (fileContents.indexOf('\'jupyter.lab.setting-icon-label\'?: ISchema;') > 0) {
        updated = true;
        fileContents = fileContents.replace('\'jupyter.lab.setting-icon-label\'?: ISchema;', '');
    }
    if (updated) {
        fs.writeFileSync(filePath, fileContents);
        // tslint:disable-next-line:no-console
        console.log(colors.green(relativePath + " file updated (by Python VSC)"));
    } else {
        // tslint:disable-next-line:no-console
        console.log(colors.red(relativePath + " file does not need updating."));
    }
}
fixJupyterLabDTSFiles();
