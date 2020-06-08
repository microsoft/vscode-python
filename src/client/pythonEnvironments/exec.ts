// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export type PythonExecInfo = {
    command: string;
    args: string[];

    python: string[];
};

export function buildPythonExecInfo(python: string | string[] | PythonExecInfo, pythonArgs?: string[]): PythonExecInfo {
    if (Array.isArray(python)) {
        const args = python.slice(1);
        if (pythonArgs) {
            args.push(...pythonArgs);
        }
        return { command: python[0], args, python };
    } else if (python instanceof Object) {
        const info = { command: python.command, args: [...python.args], python: [...python.python] };
        if (pythonArgs) {
            info.args.push(...pythonArgs);
        }
        return info;
    } else {
        return { command: python, args: pythonArgs || [], python: [python] };
    }
}
