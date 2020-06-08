// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export type PythonExecInfo = {
    command: string;
    args: string[];

    python: string[];
    pythonExecutable: string;
};

export function buildPythonExecInfo(python: string | string[] | PythonExecInfo, pythonArgs?: string[]): PythonExecInfo {
    if (Array.isArray(python)) {
        const args = python.slice(1);
        if (pythonArgs) {
            args.push(...pythonArgs);
        }
        return {
            command: python[0],
            args,
            python,
            pythonExecutable: python[python.length - 1]
        };
    } else if (python instanceof Object) {
        const info = {
            command: python.command,
            args: [...python.args],
            python: [...python.python],
            pythonExecutable: python.pythonExecutable
        };
        if (pythonArgs) {
            info.args.push(...pythonArgs);
        }
        if (info.pythonExecutable === undefined) {
            // This isn't necessarily true...
            info.pythonExecutable = info.python[info.python.length - 1];
        }
        return info;
    } else {
        return {
            command: python,
            args: pythonArgs || [],
            python: [python],
            pythonExecutable: python
        };
    }
}
