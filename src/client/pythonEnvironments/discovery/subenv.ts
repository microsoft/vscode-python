// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

interface IFSPaths {
    dirname(filename: string): string;
    basename(filename: string): string;
}

export async function getName(
    python: string,
    dirname: string | undefined,
    isPipenvRoot: (dir: string, python: string) => Promise<boolean>,
    path: IFSPaths
): Promise<string> {
    if (dirname && (await isPipenvRoot(dirname, python))) {
        // In pipenv, return the folder name of the root dir.
        return path.basename(dirname);
    } else {
        return path.basename(path.dirname(path.dirname(python)));
    }
}
