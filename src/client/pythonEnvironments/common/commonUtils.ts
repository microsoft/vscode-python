// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { chain, iterable } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { PythonVersion, UNKNOWN_PYTHON_VERSION } from '../base/info';
import { getPythonVersionInfoHeuristic } from '../base/info/env';
import { parseVersion } from '../base/info/pythonVersion';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

export async function* findInterpretersInDir(
    root:string,
    recurseLevels?:number,
    dirFilter?:(x:string)=>boolean,
): AsyncIterableIterator<string> {
    const os = getOSType();
    const checkBin = os === OSType.Windows ? isWindowsPythonExe : isPosixPythonBin;

    function defaultFilter() { return true; }
    const itemFilter = dirFilter ?? defaultFilter;

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

export async function getPythonVersionFromNearByFiles(interpreterPath:string): Promise<PythonVersion> {
    const root = path.dirname(interpreterPath);
    let version = UNKNOWN_PYTHON_VERSION;
    let heuristic = getPythonVersionInfoHeuristic(version);
    for await (const interpreter of findInterpretersInDir(root)) {
        try {
            const curVersion = parseVersion(path.basename(interpreter));
            const curHeuristic = getPythonVersionInfoHeuristic(curVersion);
            if (curHeuristic > heuristic) {
                version = curVersion;
                heuristic = curHeuristic;
            }
        } catch (ex) {
            // Ignore any parse errors
        }
    }
    return version;
}
