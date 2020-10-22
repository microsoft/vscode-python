// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { chain, iterable } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { isPosixPythonBin } from './posixUtils';
import { isWindowsPythonExe } from './windowsUtils';

export async function* findInterpretersInDir(root:string, recurseLevels?:number): AsyncIterableIterator<string> {
    const dirContents = (await fsapi.readdir(root)).map((c) => path.join(root, c));
    const os = getOSType();
    const checkBin = os === OSType.Windows ? isWindowsPythonExe : isPosixPythonBin;
    const generators = dirContents.map((item) => {
        async function* generator() {
            const stat = await fsapi.lstat(item);

            if (stat.isDirectory()) {
                if (recurseLevels && recurseLevels > 0) {
                    const subItems = findInterpretersInDir(item, recurseLevels - 1);

                    for await (const subItem of subItems) {
                        yield subItem;
                    }
                }
            } else if (checkBin(item)) {
                yield item;
            }
        }

        return generator();
    });

    yield* iterable(chain(generators));
}
