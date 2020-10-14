// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { getOSType, OSType } from '../../common/utils/platform';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

export async function findInterpretersInDir(root:string, recurseLevels?:number):Promise<string[]> {
    let interpreters:string[] = [];
    const dirContents = (await fsapi.readdir(root)).map((c) => path.join(root, c));
    const os = getOSType();

    for (const item of dirContents) {
        const stat = await fsapi.lstat(item);
        if (stat.isDirectory()) {
            if (recurseLevels && recurseLevels > 0) {
                interpreters = interpreters.concat(await findInterpretersInDir(item, recurseLevels - 1));
            }
        } else if (os === OSType.Windows && isWindowsPythonExe(item)) {
            interpreters.push(item);
        } else if (os !== OSType.Windows && isPosixPythonBin(item)) {
            interpreters.push(item);
        }
    }

    return interpreters;
}
