// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { inject, injectable } from 'inversify';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { createDeferred } from '../utils/async';
import { noop } from '../utils/misc';
import { FileSystemPaths, FileSystemPathUtils } from './fs-paths';
import { TemporaryFileSystem } from './fs-temp';
// prettier-ignore
import {
    FileStat, FileType,
    IFileSystem, IFileSystemPaths, IPlatformService, IRawFileSystem,
    ReadStream, TemporaryFile, WriteStream
} from './types';

const ENCODING: string = 'utf8';

const globAsync = promisify(glob);

// This helper function determines the file type of the given stats
// object.  The type follows the convention of node's fs module, where
// a file has exactly one type.  Symlinks are not resolved.
function convertFileType(stat: fs.Stats): FileType {
    if (stat.isFile()) {
        return FileType.File;
    } else if (stat.isDirectory()) {
        return FileType.Directory;
    } else if (stat.isSymbolicLink()) {
        // The caller is responsible for combining this ("logical or")
        // with File or Directory as necessary.
        return FileType.SymbolicLink;
    } else {
        return FileType.Unknown;
    }
}

async function getFileType(filename: string): Promise<FileType> {
    let stat: fs.Stats;
    try {
        // Note that we used to use stat() here instead of lstat().
        // This shouldn't matter because the only consumers were
        // internal methods that have been updated appropriately.
        stat = await fs.lstat(filename);
    } catch {
        return FileType.Unknown;
    }
    if (!stat.isSymbolicLink()) {
        return convertFileType(stat);
    }

    // For symlinks we emulate the behavior of the vscode.workspace.fs API.
    // See: https://code.visualstudio.com/api/references/vscode-api#FileType
    try {
        stat = await fs.stat(filename);
    } catch {
        return FileType.SymbolicLink;
    }
    if (stat.isFile()) {
        return FileType.SymbolicLink | FileType.File;
    } else if (stat.isDirectory()) {
        return FileType.SymbolicLink | FileType.Directory;
    } else {
        return FileType.SymbolicLink;
    }
}

export function convertStat(old: fs.Stats, filetype: FileType): FileStat {
    return {
        type: filetype,
        size: old.size,
        // FileStat.ctime and FileStat.mtime only have 1-millisecond
        // resolution, while node provides nanosecond resolution.  So
        // for now we round to the nearest integer.
        // See: https://github.com/microsoft/vscode/issues/84526
        ctime: Math.round(old.ctimeMs),
        mtime: Math.round(old.mtimeMs)
    };
}

//==========================================
// "raw" filesystem

// This is the parts of the vscode.workspace.fs API that we use here.
// See: https://code.visualstudio.com/api/references/vscode-api#FileSystem
// Note that we have used all the API functions *except* "rename()".
interface IVSCodeFileSystemAPI {
    stat(uri: vscode.Uri): Thenable<FileStat>;
}

// This is the parts of the 'fs-extra' module that we use in RawFileSystem.
interface IRawFSExtra {
    lstat(filename: string): Promise<fs.Stats>;
    readdir(dirname: string): Promise<string[]>;
    readFile(filename: string): Promise<Buffer>;
    readFile(filename: string, encoding: string): Promise<string>;
    mkdirp(dirname: string): Promise<void>;
    chmod(filePath: string, mode: string | number): Promise<void>;
    rename(src: string, tgt: string): Promise<void>;
    writeFile(filename: string, data: {}, options: {}): Promise<void>;
    appendFile(filename: string, data: {}): Promise<void>;
    unlink(filename: string): Promise<void>;
    rmdir(dirname: string): Promise<void>;

    // non-async
    statSync(filename: string): fs.Stats;
    readFileSync(path: string, encoding: string): string;
    createReadStream(filename: string): ReadStream;
    createWriteStream(filename: string): WriteStream;
}

interface IRawPath {
    join(...paths: string[]): string;
}

// Later we will drop "FileSystem", switching usage to
// "FileSystemUtils" and then rename "RawFileSystem" to "FileSystem".

// The low-level filesystem operations used by the extension.
export class RawFileSystem implements IRawFileSystem {
    // prettier-ignore
    constructor(
        protected readonly paths: IRawPath,
        protected readonly vscfs: IVSCodeFileSystemAPI,
        protected readonly fsExtra: IRawFSExtra
    ) { }

    // Create a new object using common-case default values.
    // prettier-ignore
    public static withDefaults(
        paths?: IRawPath,
        vscfs?: IVSCodeFileSystemAPI,
        fsExtra?: IRawFSExtra
    ): RawFileSystem{
        // prettier-ignore
        return new RawFileSystem(
            paths || FileSystemPaths.withDefaults(),
            vscfs || vscode.workspace.fs,
            fsExtra || fs
        );
    }

    public async stat(filename: string): Promise<FileStat> {
        // Note that, prior to the November release of VS Code,
        // stat.ctime was always 0.
        // See: https://github.com/microsoft/vscode/issues/84525
        const uri = vscode.Uri.file(filename);
        return this.vscfs.stat(uri);
    }

    public async lstat(filename: string): Promise<FileStat> {
        const stat = await this.fsExtra.lstat(filename);
        // Note that, unlike stat(), lstat() does not include the type
        // of the symlink's target.
        const fileType = convertFileType(stat);
        return convertStat(stat, fileType);
    }

    public async chmod(filename: string, mode: string | number): Promise<void> {
        return this.fsExtra.chmod(filename, mode);
    }

    public async move(src: string, tgt: string) {
        await this.fsExtra.rename(src, tgt);
    }

    public async readData(filename: string): Promise<Buffer> {
        return this.fsExtra.readFile(filename);
    }

    public async readText(filename: string): Promise<string> {
        return this.fsExtra.readFile(filename, ENCODING);
    }

    public async writeText(filename: string, text: string): Promise<void> {
        await this.fsExtra.writeFile(filename, text, { encoding: ENCODING });
    }

    public async appendText(filename: string, text: string): Promise<void> {
        return this.fsExtra.appendFile(filename, text);
    }

    public async copyFile(src: string, dest: string): Promise<void> {
        const deferred = createDeferred<void>();
        // prettier-ignore
        const rs = this.fsExtra.createReadStream(src)
            .on('error', err => {
                deferred.reject(err);
            });
        // prettier-ignore
        const ws = this.fsExtra.createWriteStream(dest)
            .on('error', err => {
                deferred.reject(err);
            })
            .on('close', () => {
                deferred.resolve();
            });
        rs.pipe(ws);
        return deferred.promise;
    }

    public async rmfile(filename: string): Promise<void> {
        return this.fsExtra.unlink(filename);
    }

    public async rmtree(dirname: string): Promise<void> {
        return this.fsExtra.rmdir(dirname);
    }

    public async mkdirp(dirname: string): Promise<void> {
        return this.fsExtra.mkdirp(dirname);
    }

    public async listdir(dirname: string): Promise<[string, FileType][]> {
        const files = await this.fsExtra.readdir(dirname);
        const promises = files.map(async basename => {
            const filename = this.paths.join(dirname, basename);
            const fileType = await getFileType(filename);
            return [filename, fileType] as [string, FileType];
        });
        return Promise.all(promises);
    }

    //****************************
    // non-async

    public readTextSync(filename: string): string {
        return this.fsExtra.readFileSync(filename, ENCODING);
    }

    public createReadStream(filename: string): ReadStream {
        return this.fsExtra.createReadStream(filename);
    }

    public createWriteStream(filename: string): WriteStream {
        return this.fsExtra.createWriteStream(filename);
    }
}

//==========================================
// filesystem "utils" (& legacy aliases)

@injectable()
export class FileSystem implements IFileSystem {
    private readonly paths: IFileSystemPaths;
    private readonly pathUtils: FileSystemPathUtils;
    private readonly tmp: TemporaryFileSystem;
    private readonly raw: RawFileSystem;
    // prettier-ignore
    constructor(
        @inject(IPlatformService) platformService: IPlatformService
    ) {
        // prettier-ignore
        this.paths = FileSystemPaths.withDefaults(
            platformService.isWindows
        );
        this.pathUtils = FileSystemPathUtils.withDefaults(this.paths);
        this.tmp = TemporaryFileSystem.withDefaults();
        this.raw = RawFileSystem.withDefaults(this.paths);
    }

    //=================================
    // path-related

    public get directorySeparatorChar(): string {
        return this.paths.sep;
    }

    public arePathsSame(path1: string, path2: string): boolean {
        return this.pathUtils.arePathsSame(path1, path2);
    }

    //=================================
    // "raw" operations

    public async stat(filename: string): Promise<FileStat> {
        return this.raw.stat(filename);
    }

    public async lstat(filename: string): Promise<FileStat> {
        return this.raw.lstat(filename);
    }

    public async readFile(filePath: string): Promise<string> {
        return this.raw.readText(filePath);
    }
    public readFileSync(filePath: string): string {
        return this.raw.readTextSync(filePath);
    }
    public async readData(filePath: string): Promise<Buffer> {
        return this.raw.readData(filePath);
    }

    public async writeFile(filePath: string, text: string, _options: string | fs.WriteFileOptions = { encoding: 'utf8' }): Promise<void> {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO (GH-8542) For now we ignore the options, since all call
        // sites already match the defaults.  Later we will fix the call
        // sites.
        return this.raw.writeText(filePath, text);
    }

    public async createDirectory(directoryPath: string): Promise<void> {
        return this.raw.mkdirp(directoryPath);
    }

    public async deleteDirectory(directoryPath: string): Promise<void> {
        return this.raw.rmtree(directoryPath);
    }

    public async listdir(dirname: string): Promise<[string, FileType][]> {
        return this.raw.listdir(dirname);
    }

    public async appendFile(filename: string, text: string): Promise<void> {
        return this.raw.appendText(filename, text);
    }

    public async copyFile(src: string, dest: string): Promise<void> {
        return this.raw.copyFile(src, dest);
    }

    public async deleteFile(filename: string): Promise<void> {
        return this.raw.rmfile(filename);
    }

    public async chmod(filePath: string, mode: string | number): Promise<void> {
        return this.raw.chmod(filePath, mode);
    }

    public async move(src: string, tgt: string) {
        await this.raw.move(src, tgt);
    }

    public createReadStream(filePath: string): ReadStream {
        return this.raw.createReadStream(filePath);
    }

    public createWriteStream(filePath: string): WriteStream {
        return this.raw.createWriteStream(filePath);
    }

    //=================================
    // utils

    public objectExists(filePath: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            // Note that we are using stat() rather than lstat().  This
            // means that any symlinks are getting resolved.
            fs.stat(filePath, (error, stats) => {
                if (error) {
                    return resolve(false);
                }
                return resolve(statCheck(stats));
            });
        });
    }
    public fileExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isFile());
    }
    public fileExistsSync(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
    public directoryExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isDirectory());
    }

    public async getSubDirectories(dirname: string): Promise<string[]> {
        let files: [string, FileType][];
        try {
            files = await this.listdir(dirname);
        } catch {
            // We're only preserving pre-existng behavior here...
            return [];
        }
        return files
            .filter(([_file, fileType]) => {
                // We preserve the pre-existing behavior of following
                // symlinks.
                return (fileType & FileType.Directory) > 0;
            })
            .map(([filename, _ft]) => filename);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        let files: [string, FileType][];
        try {
            files = await this.listdir(dirname);
        } catch (err) {
            // This matches what getSubDirectories() does.
            if (!(await fs.pathExists(dirname))) {
                return [];
            }
            throw err; // re-throw
        }
        return files
            .filter(([_file, fileType]) => {
                // We preserve the pre-existing behavior of following
                // symlinks.
                return (fileType & FileType.File) > 0;
            })
            .map(([filename, _ft]) => filename);
    }

    public getFileHash(filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            fs.lstat(filePath, (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    const actual = createHash('sha512')
                        .update(`${stats.ctimeMs}-${stats.mtimeMs}`)
                        .digest('hex');
                    resolve(actual);
                }
            });
        });
    }

    public async search(globPattern: string, cwd?: string): Promise<string[]> {
        let found: string[];
        if (cwd) {
            const options = {
                cwd: cwd
            };
            found = await globAsync(globPattern, options);
        } else {
            found = await globAsync(globPattern);
        }
        return Array.isArray(found) ? found : [];
    }

    public createTemporaryFile(extension: string): Promise<TemporaryFile> {
        return this.tmp.createFile(extension);
    }

    public async isDirReadonly(dirname: string): Promise<boolean> {
        const filePath = `${dirname}${this.paths.sep}___vscpTest___`;
        return new Promise<boolean>(resolve => {
            fs.open(filePath, fs.constants.O_CREAT | fs.constants.O_RDWR, (error, fd) => {
                if (!error) {
                    fs.close(fd, () => {
                        fs.unlink(filePath, noop);
                    });
                }
                return resolve(!error);
            });
        });
    }
}
