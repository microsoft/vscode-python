// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as nodepath from 'path';
import { getSearchPathEnvVarNames } from '../utils/exec';
import { getOSType, OSType } from '../utils/platform';
import { IExecutables, IFileSystemPaths, IFileSystemPathUtils } from './types';

const untildify = require('untildify');

// The parts of node's 'path' module used by FileSystemPaths.
interface INodePath {
    sep: string;
    join(...filenames: string[]): string;
    dirname(filename: string): string;
    basename(filename: string, ext?: string): string;
    normalize(filename: string): string;
}

export class FileSystemPaths implements IFileSystemPaths {
    constructor(
        // "true" if targeting a case-insensitive host (like Windows)
        private readonly isCaseInsensitive: boolean,
        // (effectively) the node "path" module to use
        private readonly raw: INodePath,
    ) {}
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(
        // default: use "isWindows"
        isCaseInsensitive?: boolean,
    ): FileSystemPaths {
        if (isCaseInsensitive === undefined) {
            isCaseInsensitive = getOSType() === OSType.Windows;
        }
        return new FileSystemPaths(
            isCaseInsensitive,
            // Use the actual node "path" module.
            nodepath,
        );
    }

    public get sep(): string {
        return this.raw.sep;
    }

    public join(...filenames: string[]): string {
        return this.raw.join(...filenames);
    }

    public dirname(filename: string): string {
        return this.raw.dirname(filename);
    }

    public basename(filename: string, suffix?: string): string {
        return this.raw.basename(filename, suffix);
    }

    public normalize(filename: string): string {
        return this.raw.normalize(filename);
    }

    public normCase(filename: string): string {
        filename = this.raw.normalize(filename);
        return this.isCaseInsensitive ? filename.toUpperCase() : filename;
    }
}

export class Executables {
    constructor(
        // the $PATH delimiter to use
        public readonly delimiter: string,
        // the OS type to target
        private readonly osType: OSType,
    ) {}
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(): Executables {
        return new Executables(
            // Use node's value.
            nodepath.delimiter,
            // Use the current OS.
            getOSType(),
        );
    }

    public get envVar(): string {
        return getSearchPathEnvVarNames(this.osType)[0];
    }
}

// The dependencies FileSystemPathUtils has on node's path module.
interface IRawPaths {
    relative(relpath: string, rootpath: string): string;
}

export class FileSystemPathUtils implements IFileSystemPathUtils {
    constructor(
        // the user home directory to use (and expose)
        public readonly home: string,
        // the low-level FS path operations to use (and expose)
        public readonly paths: IFileSystemPaths,
        // the low-level OS "executables" to use (and expose)
        public readonly executables: IExecutables,
        // other low-level FS path operations to use
        private readonly raw: IRawPaths,
    ) {}
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(
        // default: a new FileSystemPaths object (using defaults)
        paths?: IFileSystemPaths,
    ): FileSystemPathUtils {
        if (paths === undefined) {
            paths = FileSystemPaths.withDefaults();
        }
        return new FileSystemPathUtils(
            // Use the current user's home directory.
            untildify('~'),
            paths,
            Executables.withDefaults(),
            // Use the actual node "path" module.
            nodepath,
        );
    }

    public arePathsSame(path1: string, path2: string): boolean {
        path1 = this.paths.normCase(path1);
        path2 = this.paths.normCase(path2);
        return path1 === path2;
    }

    public getDisplayName(filename: string, cwd?: string): string {
        if (cwd && isParentPath(filename, cwd)) {
            return `.${this.paths.sep}${this.raw.relative(cwd, filename)}`;
        } else if (isParentPath(filename, this.home)) {
            return `~${this.paths.sep}${this.raw.relative(this.home, filename)}`;
        } else {
            return filename;
        }
    }
}

export function normCasePath(filePath: string): string {
    return normCase(nodepath.normalize(filePath));
}

export function normCase(s: string): string {
    return getOSType() === OSType.Windows ? s.toUpperCase() : s;
}

/**
 * Returns true if given file path exists within the given parent directory, false otherwise.
 * @param filePath File path to check for
 * @param parentPath The potential parent path to check for
 */
export function isParentPath(filePath: string, parentPath: string): boolean {
    if (!parentPath.endsWith(nodepath.sep)) {
        parentPath += nodepath.sep;
    }
    if (!filePath.endsWith(nodepath.sep)) {
        filePath += nodepath.sep;
    }
    return normCasePath(filePath).startsWith(normCasePath(parentPath));
}

export function arePathsSame(path1: string, path2: string): boolean {
    return normCasePath(path1) === normCasePath(path2);
}
