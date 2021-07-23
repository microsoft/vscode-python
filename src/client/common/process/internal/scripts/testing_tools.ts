// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _SCRIPTS_DIR } from './constants';

const SCRIPTS_DIR = path.join(_SCRIPTS_DIR, 'testing_tools');

//============================
// run_adapter.py

export function runAdapter(adapterArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'run_adapter.py');
    // Note that we for now we do not run this "isolated".  The
    // script relies on some magic that conflicts with the
    // isolated script.
    return [script, ...adapterArgs];
}
