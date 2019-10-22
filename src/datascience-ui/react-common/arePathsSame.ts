// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as path from 'path';
import { getOSType, OSType } from '../../client/common/utils/platform';

// Provide functionality of IFileSystem arePathsSame for the React components
export function arePathsSame(path1: string, path2: string): boolean {
    path1 = path.normalize(path1);
    path2 = path.normalize(path2);
    if (getOSType() === OSType.Windows) {
        return path1.toUpperCase() === path2.toUpperCase();
    } else {
        return path1 === path2;
    }
}
