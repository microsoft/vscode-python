// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
exports.ExtensionRootDir = path.join(__dirname, '..');
const jsonFileWithListOfOldFiles = path.join(__dirname, 'existingFiles.json');
function getListOfExcludedFiles() {
    const files = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString());
    return files.map(file => path.join(exports.ExtensionRootDir, file.replace(/\//g, path.sep)));
}
exports.filesNotToCheck = getListOfExcludedFiles();
exports.isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;
