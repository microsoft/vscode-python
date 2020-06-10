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

export async function findVenvExecutable(
    python: string,
    basename: string | string[],
    path: IFSPathsForVenvExec,
    fileExists: (n: string) => Promise<boolean>
): Promise<string | undefined> {
    // Generated scripts are found in the same directory as the interpreter.
    const binDir = path.dirname(python);
    for (const name of typeof basename === 'string' ? [basename] : basename) {
        const filename = path.join(binDir, name);
        if (await fileExists(filename)) {
            return filename;
        }
    }
    // No matches so return undefined.
}
