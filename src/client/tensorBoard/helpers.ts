// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { noop } from '../common/utils/misc';

// While it is uncommon for users to `import tensorboard`, TensorBoard is frequently
// included as a submodule of other packages, e.g. torch.utils.tensorboard.
// This is a modified version of the regex from src/client/telemetry/importTracker.ts
// in order to match on imported submodules as well, since the original regex only
// matches the 'main' module.

// eslint-disable-next-line max-len
export const ImportRegEx = /^\s*from (?<fromImport>\w+(?:\.\w+)*) import (?<fromImportTarget>\w+(?:, \w+)*)(?: as \w+)?|import (?<importImport>\w+(?:, \w+)*)(?: as \w+)?$/;

export function containsTensorBoardImport(lines: (string | undefined)[]): boolean {
    try {
        for (const s of lines) {
            const matches = s ? ImportRegEx.exec(s) : null;
            if (matches !== null && matches.groups !== undefined) {
                let componentsToCheck: string[] = [];
                if (matches.groups.fromImport && matches.groups.fromImportTarget) {
                    // from x.y.z import u, v, w
                    componentsToCheck = matches.groups.fromImport
                        .split('.')
                        .concat(matches.groups.fromImportTarget.split(','));
                } else if (matches.groups.importImport) {
                    // import package1, package2, ...
                    componentsToCheck = matches.groups.importImport.split(',');
                }
                for (const component of componentsToCheck) {
                    if (component && component.trim() === 'tensorboard') {
                        return true;
                    }
                }
            }
        }
    } catch {
        // Don't care about failures.
        noop();
    }
    return false;
}

export function containsNotebookExtension(lines: (string | undefined)[]): boolean {
    for (const s of lines) {
        if (s?.startsWith('%tensorboard') || s?.startsWith('%load_ext tensorboard')) {
            return true;
        }
    }
    return false;
}
