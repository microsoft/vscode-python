// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
exports.ExtensionRootDir = path.join(__dirname, '..', '..');
const jsonFileWithListOfOldFiles = path.join(exports.ExtensionRootDir, 'src', 'tools', 'existingFiles.json');
const filesNotToCheck = [];
function getListOfExcludedFiles() {
    if (filesNotToCheck.length === 0) {
        const files = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString());
        files.forEach(file => filesNotToCheck.push(path.join(exports.ExtensionRootDir, file)));
    }
    return filesNotToCheck;
}
exports.getListOfExcludedFiles = getListOfExcludedFiles;
