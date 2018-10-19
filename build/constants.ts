// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';

export const ExtensionRootDir = path.join(__dirname, '..', '..');

const jsonFileWithListOfOldFiles = path.join(ExtensionRootDir, 'src', 'tools', 'existingFiles.json');
const filesNotToCheck: string[] = [];

export function getListOfExcludedFiles() {
    if (filesNotToCheck.length === 0) {
        const files = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString()) as string[];
        files.forEach(file => filesNotToCheck.push(path.join(ExtensionRootDir, file)));
    }
    return filesNotToCheck;
}
