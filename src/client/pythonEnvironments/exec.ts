// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export type PythonExecInfo = {
    command: string;
    args: string[];

    python: string[];
};

export function getPythonExecInfo(python: string | string[], pythonArgs?: string[]): PythonExecInfo {
    if (Array.isArray(python)) {
        const args = python.slice(1);
        if (pythonArgs) {
            args.push(...pythonArgs);
        }
        return { command: python[0], args, python };
    } else {
        return { command: python, args: pythonArgs || [], python: [python] };
    }
}
