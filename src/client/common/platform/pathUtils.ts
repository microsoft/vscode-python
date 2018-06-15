import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IPathUtils, IsWindows } from '../types';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';

@injectable()
export class PathUtils implements IPathUtils {
    constructor(@inject(IsWindows) private isWindows: boolean) { }
    public get delimiter(): string {
        return path.delimiter;
    }
    // TO DO: Deprecate in favor of IPlatformService
    public getPathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public basename(pathValue: string, ext?: string): string {
        return path.basename(pathValue, ext);
    }

}
