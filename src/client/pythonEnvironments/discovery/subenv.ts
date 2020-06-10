// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

interface IFSPathsForName {
    dirname(filename: string): string;
    basename(filename: string): string;
}

export async function getName(
    python: string,
    dirname: string | undefined,
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>,
    path: IFSPathsForName
): Promise<string> {
    if (dirname && (await isPipenvRoot(dirname, python))) {
        // In pipenv, return the folder name of the root dir.
        return path.basename(dirname);
    } else {
        return path.basename(path.dirname(path.dirname(python)));
    }
}

interface IFSPathsForVenvExec {
    dirname(filename: string): string;
    join(...parts: string[]): string;
}

export function resolveVenvExecutable(python: string, name: string, path: IFSPathsForVenvExec): string {
    // Generated scripts are found in the same directory as the interpreter.
    const binDir = path.dirname(python);
    return path.join(binDir, name);
}
