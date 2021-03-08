// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { noop } from '../common/utils/misc';

// While it is uncommon for users to `import tensorboard`, TensorBoard is frequently
// included as a submodule of other packages, e.g. torch.utils.tensorboard.
// This is a modified version of the regex from src/client/telemetry/importTracker.ts
// in order to match on imported submodules as well, since the original regex only
// matches the 'main' module.

// RegEx to match `import torch.profiler` or `from torch import profiler`
const TorchProfilerImportRegEx = /^\s*(?:import (?:(\w+, )*torch\.profiler(, \w+)*))|(?:from torch import (?:(\w+, )*profiler(, \w+)*))/;
// RegEx to match `from torch.utils import tensorboard`, `import torch.utils.tensorboard`, `import tensorboardX`, `import tensorboard`
const TensorBoardImportRegEx = /^\s*(?:from torch\.utils\.tensorboard import \w+)|(?:from torch\.utils import (?:(\w+, )*tensorboard(, \w+)*))|(?:from tensorboardX import \w+)|(?:import (\w+, )*((torch\.utils\.tensorboard)|(tensorboardX)|(tensorboard))(, \w+)*)/;

export function containsTensorBoardImport(lines: (string | undefined)[]): boolean {
    try {
        for (const s of lines) {
            if (s && (TensorBoardImportRegEx.test(s) || TorchProfilerImportRegEx.test(s))) {
                return true;
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
