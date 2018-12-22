import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPathUtils, IsWindows } from '../types';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
// tslint:disable-next-line:no-var-requires no-require-imports
const untildify = require('untildify');

@injectable()
export class PathUtils implements IPathUtils {
    public readonly home = '';
    constructor(@inject(IsWindows) private isWindows: boolean) {
        this.home = untildify('~');
    }
    public get delimiter(): string {
        return path.delimiter;
    }
    public get separator(): string {
        return path.sep;
    }
    // TO DO: Deprecate in favor of IPlatformService
    public getPathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public basename(pathValue: string, ext?: string): string {
        return path.basename(pathValue, ext);
    }
    public getDisplayName(pathValue: string, cwd?: string): string {
        if (cwd && pathValue.startsWith(cwd)) {
            return `.${path.sep}${path.relative(cwd, pathValue)}`;
        } else if (pathValue.startsWith(this.home)) {
            return `~${path.sep}${path.relative(this.home, pathValue)}`;
        } else {
            return pathValue;
        }
    }
}
