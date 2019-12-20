// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as nodepath from 'path';
import { getOSType, OSType } from '../utils/platform';
import {
    IExecutables,
    IFileSystemPaths
} from './types';
// tslint:disable-next-line:no-var-requires no-require-imports
const untildify = require('untildify');

// The parts of node's 'path' module used by FileSystemPaths.
interface INodePath {
    sep: string;
    join(...filenames: string[]): string;
    basename(filename: string, ext?: string): string;
    normalize(filename: string): string;
}

// The file path operations used by the extension.
export class FileSystemPaths {
    constructor(
        private readonly isCaseInsensitive: boolean,
        private readonly raw: INodePath
    ) { }
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(): FileSystemPaths {
        return new FileSystemPaths(
            (getOSType() === OSType.Windows),
            nodepath
        );
    }

    public get sep(): string {
        return this.raw.sep;
    }

    public join(...filenames: string[]): string {
        return this.raw.join(...filenames);
    }

    public basename(filename: string, suffix?: string): string {
        return this.raw.basename(filename, suffix);
    }

    public normalize(filename: string): string {
        return this.raw.normalize(filename);
    }

    public normCase(filename: string): string {
        filename = this.raw.normalize(filename);
        return this.isCaseInsensitive
            ? filename.toUpperCase()
            : filename;
    }
}

export class Executables {
    constructor(
        public readonly delimiter: string,
        private readonly osType: OSType
    ) { }
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(): Executables {
        return new Executables(
            nodepath.delimiter,
            getOSType()
        );
    }

    public get envVar(): string {
        return this.osType === OSType.Windows
            ? 'Path'
            : 'PATH';
    }
}

interface IRawPaths {
    relative(relpath: string, rootpath: string): string;
}

export class FileSystemPathUtils {
    constructor(
        public readonly home: string,
        public readonly paths: IFileSystemPaths,
        public readonly executables: IExecutables,
        private readonly raw: IRawPaths
    ) { }
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our typical approach.
    public static withDefaults(): FileSystemPathUtils {
        return new FileSystemPathUtils(
            untildify('~'),
            FileSystemPaths.withDefaults(),
            Executables.withDefaults(),
            nodepath
        );
    }

    public getDisplayName(pathValue: string, cwd?: string): string {
        if (cwd && pathValue.startsWith(cwd)) {
            return `.${this.paths.sep}${this.raw.relative(cwd, pathValue)}`;
        } else if (pathValue.startsWith(this.home)) {
            return `~${this.paths.sep}${this.raw.relative(this.home, pathValue)}`;
        } else {
            return pathValue;
        }
    }
}
