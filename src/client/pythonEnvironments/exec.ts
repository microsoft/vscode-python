// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// A representation of the information needed to run a Python executable.
export type PythonExecInfo = {
    command: string;
    args: string[];

    python: string[];
    pythonExecutable: string;
};

// Compose Python execution info for the given executable.
export function buildPythonExecInfo(python: string | string[], pythonArgs?: string[]): PythonExecInfo {
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
    } else {
        return {
            command: python,
            args: pythonArgs || [],
            python: [python],
            pythonExecutable: python
        };
    }
}

// Create a copy, optionally adding to the args to pass to Python.
export function copyPythonExecInfo(orig: PythonExecInfo, extraPythonArgs?: string[]): PythonExecInfo {
    const info = {
        command: orig.command,
        args: [...orig.args],
        python: [...orig.python],
        pythonExecutable: orig.pythonExecutable
    };
    if (extraPythonArgs) {
        info.args.push(...extraPythonArgs);
    }
    if (info.pythonExecutable === undefined) {
        // This isn't necessarily true...
        info.pythonExecutable = info.python[info.python.length - 1];
    }
    return info;
}
