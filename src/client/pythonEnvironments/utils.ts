// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IFileSystem } from '../common/platform/types';
import { PartialPythonEnvironment } from './info';

export function resolvePossibleSymlinkToRealPath(interpreterPath: string) {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Add the API to resolve symlink later
    return interpreterPath;
}

export async function isEnvironmentValid(interpreter: PartialPythonEnvironment, fs: IFileSystem): Promise<boolean> {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Note that the file path may still exist but it's possible that the environment changed.
    // We may need to check file hashes here as well.
    return fs.fileExists(interpreter.path);
}
