// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';

export const ExtensionRootDir = path.dirname(__dirname);

export function getListOfFiles(filename: string): string[] {
    filename = path.normalize(filename);
    if (!path.isAbsolute(filename)) {
        filename = path.join(__dirname, filename);
    }

    const data = fs.readFileSync(filename).toString();
    const files = JSON.parse(data) as string[];
    return files
        .map(file => {
            return path.join(ExtensionRootDir, file.replace(/\//g, path.sep));
        });
}
