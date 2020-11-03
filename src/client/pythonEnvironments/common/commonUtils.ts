// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { chain, iterable } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../base/info';
import { comparePythonVersionSpecificity } from '../base/info/env';
import { parseVersion } from '../base/info/pythonVersion';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

/**
 * Searches recursively under the given `root` directory for python interpreters.
 * @param root : Directory where the search begins.
 * @param recurseLevels : Number of levels to search for from the root directory.
 * @param filter : Callback that identifies directories to ignore.
 */
export async function* findInterpretersInDir(
    root: string,
    recurseLevels?: number,
    filter?: (x: string) => boolean,
): AsyncIterableIterator<string> {
    const os = getOSType();
    const checkBin = os === OSType.Windows ? isWindowsPythonExe : isPosixPythonBin;
    const itemFilter = filter ?? (() => true);

    const dirContents = (await fsapi.readdir(root)).filter(itemFilter);

    const generators = dirContents.map((item) => {
        async function* generator() {
            const fullPath = path.join(root, item);
            const stat = await fsapi.lstat(fullPath);

            if (stat.isDirectory()) {
                if (recurseLevels && recurseLevels > 0) {
                    const subItems = findInterpretersInDir(fullPath, recurseLevels - 1);

                    for await (const subItem of subItems) {
                        yield subItem;
                    }
                }
            } else if (checkBin(fullPath)) {
                yield fullPath;
            }
        }

        return generator();
    });

    yield* iterable(chain(generators));
}

/**
 * Looks for files in the same directory which might have version in their name.
 * @param interpreterPath
 */
export async function getPythonVersionFromNearByFiles(interpreterPath:string): Promise<PythonVersion> {
    const root = path.dirname(interpreterPath);
    let version = UNKNOWN_PYTHON_VERSION;
    for await (const interpreter of findInterpretersInDir(root)) {
        try {
            const curVersion = parseVersion(path.basename(interpreter));
            if (comparePythonVersionSpecificity(curVersion, version) > 0) {
                version = curVersion;
            }
        } catch (ex) {
            // Ignore any parse errors
        }
    }
    return version;
}
