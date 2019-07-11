// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawnSync } from 'child_process';
import * as glob from 'glob';
import * as path from 'path';
import { QuickOpen as VSCQuickOpen } from '../../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Code, getBuildElectronPath } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { Editors } from './editors';

export class QuickOpen extends VSCQuickOpen {
    constructor(code: Code, editors: Editors) {
        super(code, editors);
    }

    public async openFile(fileName: string): Promise<void> {
        const pattern = path.join(context.options.workspacePathOrFolder, '**', fileName);
        try {
            const executable = getBuildElectronPath(context.app.testOptions.vscodePath);
            const fullFilePath = await new Promise<string>((resolve, reject) => glob(pattern, (error, files) => {
                if (error) {
                    return reject(error);
                }
                switch (files.length) {
                    case 0:
                        return reject(new Error(`No files matching the name ${fileName}`));
                    case 1:
                        return resolve(files[1]);
                    default:
                        return reject(new Error(`Too many files matching the name ${fileName}, matching files are ${files.join(',')}`));
                }
            }));
            spawnSync(executable, [fullFilePath]);
        } catch (ex) {
            console.error(`Unable to open file using \'code <full path to filename>\' for pattern '${pattern}'`, ex);
            // Revert to the old approach.
            return super.openFile(fileName);
        }
    }
}
