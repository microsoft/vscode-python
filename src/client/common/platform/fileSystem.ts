// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { injectable } from 'inversify';
import { promisify } from 'util';
import * as vscode from 'vscode';
import '../../common/extensions';
import { createDeferred } from '../utils/async';
import { isFileNotFoundError, isNoPermissionsError } from './errors';
import { FileSystemPaths, FileSystemPathUtils } from './fs-paths';
import { TemporaryFileSystem } from './fs-temp';
import {
    FileStat,
    FileType,
    IFileSystem,
    IFileSystemPaths,
    IFileSystemPathUtils,
    IFileSystemUtils,
    IRawFileSystem,
    ITempFileSystem,
    ReadStream,
    TemporaryFile,
    WriteStream
} from './types';

const ENCODING: string = 'utf8';

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

// prettier-ignore
function filterByFileType(
    files: [string, FileType][],
    fileType: FileType
): [string, FileType][] {
    // We preserve the pre-existing behavior of following symlinks.
    if (fileType === FileType.Unknown) {
        // FileType.Unknown == 0 so we can't just use bitwise
        // operations blindly here.
        return files.filter(([_file, ft]) => {
            return ft === FileType.Unknown || ft === (FileType.SymbolicLink & FileType.Unknown);
        });
    } else {
        return files.filter(([_file, ft]) => (ft & fileType) > 0);
    }
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
    stat(filename: string): Promise<fs.Stats>;
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
    ): RawFileSystem {
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
            // Note that this follows symlinks (while still preserving
            // the Symlink flag).
            const fileType = await this.getFileType(filename);
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

    //****************************
    // internal

    private async getFileType(filename: string): Promise<FileType> {
        let stat: fs.Stats;
        try {
            // Note that we used to use stat() here instead of lstat().
            // This shouldn't matter because the only consumers were
            // internal methods that have been updated appropriately.
            stat = await this.fsExtra.lstat(filename);
        } catch (err) {
            if (isFileNotFoundError(err)) {
                return FileType.Unknown;
            }
            throw err;
        }
        if (!stat.isSymbolicLink()) {
            return convertFileType(stat);
        }

        // For symlinks we emulate the behavior of the vscode.workspace.fs API.
        // See: https://code.visualstudio.com/api/references/vscode-api#FileType
        try {
            stat = await this.fsExtra.stat(filename);
        } catch (err) {
            if (isFileNotFoundError(err)) {
                return FileType.SymbolicLink;
            }
            throw err;
        }
        if (stat.isFile()) {
            return FileType.SymbolicLink | FileType.File;
        } else if (stat.isDirectory()) {
            return FileType.SymbolicLink | FileType.Directory;
        } else {
            return FileType.SymbolicLink;
        }
    }
}

//==========================================
// filesystem "utils"

// This is the parts of the 'fs-extra' module that we use in RawFileSystem.
interface IFSExtraForUtils {
    open(path: string, flags: string | number, mode?: string | number | null): Promise<number>;
    close(fd: number): Promise<void>;
    unlink(path: string): Promise<void>;
    existsSync(path: string): boolean;
}

// High-level filesystem operations used by the extension.
export class FileSystemUtils implements IFileSystemUtils {
    constructor(
        public readonly raw: IRawFileSystem,
        public readonly pathUtils: IFileSystemPathUtils,
        public readonly paths: IFileSystemPaths,
        public readonly tmp: ITempFileSystem,
        // tslint:disable-next-line:no-shadowed-variable
        private readonly fs: IFSExtraForUtils,
        private readonly getHash: (data: string) => string,
        private readonly globFiles: (pat: string, options?: { cwd: string }) => Promise<string[]>
    ) {}
    // Create a new object using common-case default values.
    public static withDefaults(
        raw?: IRawFileSystem,
        pathUtils?: IFileSystemPathUtils,
        tmp?: ITempFileSystem,
        fsDeps?: IFSExtraForUtils,
        getHash?: (data: string) => string,
        globFiles?: (pat: string, options?: { cwd: string }) => Promise<string[]>
    ): FileSystemUtils {
        pathUtils = pathUtils || FileSystemPathUtils.withDefaults();
        return new FileSystemUtils(
            raw || RawFileSystem.withDefaults(pathUtils.paths),
            pathUtils,
            pathUtils.paths,
            tmp || TemporaryFileSystem.withDefaults(),
            fsDeps || fs,
            getHash || getHashString,
            globFiles || promisify(glob)
        );
    }

    //****************************
    // aliases

    public async createDirectory(directoryPath: string): Promise<void> {
        return this.raw.mkdirp(directoryPath);
    }

    public async deleteDirectory(directoryPath: string): Promise<void> {
        return this.raw.rmtree(directoryPath);
    }

    public async deleteFile(filename: string): Promise<void> {
        return this.raw.rmfile(filename);
    }

    //****************************
    // helpers

    // prettier-ignore
    public async pathExists(
        filename: string,
        fileType?: FileType
    ): Promise<boolean> {
        let stat: FileStat;
        try {
            // Note that we are using stat() rather than lstat().  This
            // means that any symlinks are getting resolved.
            stat = await this.raw.stat(filename);
        } catch (err) {
            if (isFileNotFoundError(err)) {
                return false;
            }
            throw err;
        }

        if (fileType === undefined) {
            return true;
        }
        if (fileType === FileType.Unknown) {
            // FileType.Unknown == 0, hence do not use bitwise operations.
            return stat.type === FileType.Unknown;
        }
        return (stat.type & fileType) === fileType;
    }
    public async fileExists(filename: string): Promise<boolean> {
        return this.pathExists(filename, FileType.File);
    }
    public async directoryExists(dirname: string): Promise<boolean> {
        return this.pathExists(dirname, FileType.Directory);
    }

    public async listdir(dirname: string): Promise<[string, FileType][]> {
        // prettier-ignore
        return this.raw.listdir(dirname)
            .catch(async err => {
                // We're only preserving pre-existng behavior here...
                if (!(await this.pathExists(dirname))) {
                    return [];
                }
                throw err; // re-throw
            });
    }
    public async getSubDirectories(dirname: string): Promise<string[]> {
        // prettier-ignore
        return filterByFileType(
            (await this.listdir(dirname)),
            FileType.Directory
        ).map(([filename, _fileType]) => filename);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        // prettier-ignore
        return filterByFileType(
            (await this.listdir(dirname)),
            FileType.File
        ).map(([filename, _fileType]) => filename);
    }

    public async isDirReadonly(dirname: string): Promise<boolean> {
        const filePath = `${dirname}${this.paths.sep}___vscpTest___`;
        const flags = fs.constants.O_CREAT | fs.constants.O_RDWR;
        let fd: number;
        try {
            fd = await this.fs.open(filePath, flags);
        } catch (err) {
            if (isNoPermissionsError(err)) {
                return true;
            }
            throw err; // re-throw
        }
        // Clean resources in the background.
        this.fs
            .close(fd)
            .finally(() => this.fs.unlink(filePath))
            .ignoreErrors();
        return false;
    }

    public async getFileHash(filename: string): Promise<string> {
        // The reason for lstat rather than stat is not clear...
        const stat = await this.raw.lstat(filename);
        const data = `${stat.ctime}-${stat.mtime}`;
        return this.getHash(data);
    }

    public async search(globPattern: string, cwd?: string): Promise<string[]> {
        let found: string[];
        if (cwd) {
            const options = {
                cwd: cwd
            };
            found = await this.globFiles(globPattern, options);
        } else {
            found = await this.globFiles(globPattern);
        }
        return Array.isArray(found) ? found : [];
    }

    //****************************
    // helpers (non-async)

    public fileExistsSync(filePath: string): boolean {
        return this.fs.existsSync(filePath);
    }
}

// We *could* use ICryptoUtils, but it's a bit overkill, issue tracked
// in https://github.com/microsoft/vscode-python/issues/8438.
function getHashString(data: string): string {
    const hash = createHash('sha512');
    hash.update(data);
    return hash.digest('hex');
}

//==========================================
// legacy filesystem API

// more aliases (to cause less churn)
@injectable()
export class FileSystem implements IFileSystem {
    // We expose this for the sake of functional tests that do not have
    // access to the actual "vscode" namespace.
    protected utils: FileSystemUtils;
    constructor() {
        this.utils = FileSystemUtils.withDefaults();
    }

    public get directorySeparatorChar(): string {
        return this.utils.paths.sep;
    }
    public arePathsSame(path1: string, path2: string): boolean {
        return this.utils.pathUtils.arePathsSame(path1, path2);
    }
    public getDisplayName(path: string): string {
        return this.utils.pathUtils.getDisplayName(path);
    }
    public async stat(filename: string): Promise<FileStat> {
        return this.utils.raw.stat(filename);
    }
    public async createDirectory(dirname: string): Promise<void> {
        return this.utils.createDirectory(dirname);
    }
    public async deleteDirectory(dirname: string): Promise<void> {
        return this.utils.deleteDirectory(dirname);
    }
    public async listdir(dirname: string): Promise<[string, FileType][]> {
        return this.utils.listdir(dirname);
    }
    public async readFile(filePath: string): Promise<string> {
        return this.utils.raw.readText(filePath);
    }
    public async readData(filePath: string): Promise<Buffer> {
        return this.utils.raw.readData(filePath);
    }
    public async writeFile(filename: string, data: {}): Promise<void> {
        return this.utils.raw.writeText(filename, data);
    }
    public async appendFile(filename: string, text: string): Promise<void> {
        return this.utils.raw.appendText(filename, text);
    }
    public async copyFile(src: string, dest: string): Promise<void> {
        return this.utils.raw.copyFile(src, dest);
    }
    public async deleteFile(filename: string): Promise<void> {
        return this.utils.deleteFile(filename);
    }
    public async chmod(filename: string, mode: string): Promise<void> {
        return this.utils.raw.chmod(filename, mode);
    }
    public async move(src: string, tgt: string) {
        await this.utils.raw.move(src, tgt);
    }
    public readFileSync(filePath: string): string {
        return this.utils.raw.readTextSync(filePath);
    }
    public createReadStream(filePath: string): ReadStream {
        return this.utils.raw.createReadStream(filePath);
    }
    public createWriteStream(filePath: string): WriteStream {
        return this.utils.raw.createWriteStream(filePath);
    }
    public async fileExists(filename: string): Promise<boolean> {
        return this.utils.fileExists(filename);
    }
    public fileExistsSync(filename: string): boolean {
        return this.utils.fileExistsSync(filename);
    }
    public async directoryExists(dirname: string): Promise<boolean> {
        return this.utils.directoryExists(dirname);
    }
    public async getSubDirectories(dirname: string): Promise<string[]> {
        return this.utils.getSubDirectories(dirname);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        return this.utils.getFiles(dirname);
    }
    public async getFileHash(filename: string): Promise<string> {
        return this.utils.getFileHash(filename);
    }
    public async search(globPattern: string, cwd?: string): Promise<string[]> {
        return this.utils.search(globPattern, cwd);
    }
    public async createTemporaryFile(suffix: string): Promise<TemporaryFile> {
        return this.utils.tmp.createFile(suffix);
    }
    public async isDirReadonly(dirname: string): Promise<boolean> {
        return this.utils.isDirReadonly(dirname);
    }
}
