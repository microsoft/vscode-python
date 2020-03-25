// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../constants';
import { PythonVersionInfo } from './types';

const SCRIPTS_DIR = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');

export namespace scripts {
    //============================
    // interpreterInfo.py

    type PythonEnvInfo = {
        versionInfo: PythonVersionInfo;
        sysPrefix: string;
        sysVersion: string;
        is64Bit: boolean;
    };

    export function interpreterInfo(): [string[], (out: string) => PythonEnvInfo] {
        const script = path.join(SCRIPTS_DIR, 'interpreterInfo.py');
        const args = [script];

        function parse(out: string): PythonEnvInfo {
            let json: PythonEnvInfo;
            try {
                json = JSON.parse(out);
            } catch (ex) {
                throw Error(`python ${args} returned bad JSON (${out}) (${ex})`);
            }
            return json;
        }
        return [args, parse];
    }
}
