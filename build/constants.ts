// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';

export const ExtensionRootDir = path.join(__dirname, '..');

const jsonFileWithListOfOldFiles = path.join(__dirname, 'existingFiles.json');
function getListOfExcludedFiles() {
    const files = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString()) as string[];
    return files.map(file => path.join(ExtensionRootDir, file));
}

export const filesNotToCheck: string[] = getListOfExcludedFiles();
