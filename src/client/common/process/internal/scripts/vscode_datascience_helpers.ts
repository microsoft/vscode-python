// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _ISOLATED as ISOLATED, _SCRIPTS_DIR } from './index';

const SCRIPTS_DIR = path.join(_SCRIPTS_DIR, 'vscode_datascience_helpers');

//============================
// getServerInfo.py

type JupyterServerInfo = {
    base_url: string;
    notebook_dir: string;
    hostname: string;
    password: boolean;
    pid: number;
    port: number;
    secure: boolean;
    token: string;
    url: string;
};

export function getServerInfo(): [string[], (out: string) => JupyterServerInfo[]] {
    const script = path.join(SCRIPTS_DIR, 'getServerInfo.py');
    const args = [ISOLATED, script];

    function parse(out: string): JupyterServerInfo[] {
        return JSON.parse(out.trim());
    }

    return [args, parse];
}

//============================
// getJupyterKernels.py

export function getJupyterKernels(): string[] {
    const script = path.join(SCRIPTS_DIR, 'getJupyterKernels.py');
    // There is no script-specific output to parse, so we do not return a function.
    return [ISOLATED, script];
}

//============================
// getJupyterKernelspecVersion.py

export function getJupyterKernelspecVersion(): string[] {
    const script = path.join(SCRIPTS_DIR, 'getJupyterKernelspecVersion.py');
    // For now we do not worry about parsing the output here.
    return [ISOLATED, script];
}

//============================
// jupyter_nbInstalled.py

export function jupyter_nbInstalled(): [string[], (out: string) => boolean] {
    const script = path.join(SCRIPTS_DIR, 'jupyter_nbInstalled.py');
    const args = [ISOLATED, script];

    function parse(out: string): boolean {
        return out.toLowerCase().includes('available');
    }

    return [args, parse];
}
