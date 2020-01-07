// tslint:disable-next-line:no-suspicious-comment
// TODO(GH-8542): Drop this file.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPathUtils, IsWindows } from '../types';
import { OSType } from '../utils/platform';
// prettier-ignore
import {
    Executables,
    FileSystemPaths,
    FileSystemPathUtils
} from './fs-paths';
// tslint:disable-next-line:no-var-requires no-require-imports
const untildify = require('untildify');

@injectable()
export class PathUtils implements IPathUtils {
    private readonly utils: FileSystemPathUtils;
    // prettier-ignore
    constructor(
        @inject(IsWindows) isWindows: boolean
    ) {
        // We cannot just use FileSystemPathUtils.withDefaults() because
        // of the isWindows arg.
        // prettier-ignore
        this.utils = new FileSystemPathUtils(
            untildify('~'),
            FileSystemPaths.withDefaults(),
            new Executables(
                path.delimiter,
                isWindows ? OSType.Windows : OSType.Unknown
            ),
            path
        );
    }

    public get home(): string {
        return this.utils.home;
    }

    public get delimiter(): string {
        return this.utils.executables.delimiter;
    }

    public get separator(): string {
        return this.utils.paths.sep;
    }

    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Deprecate in favor of IPlatformService?
    public getPathVariableName(): 'Path' | 'PATH' {
        // tslint:disable-next-line:no-any
        return this.utils.executables.envVar as any;
    }

    public getDisplayName(pathValue: string, cwd?: string): string {
        return this.utils.getDisplayName(pathValue, cwd);
    }

    public basename(pathValue: string, ext?: string): string {
        return this.utils.paths.basename(pathValue, ext);
    }
}
