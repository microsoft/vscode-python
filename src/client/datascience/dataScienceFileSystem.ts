import * as fs from 'fs-extra';
import * as glob from 'glob';
import { inject, injectable } from 'inversify';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { FileStat, Uri, workspace } from 'vscode';
import { convertStat, getHashString } from '../common/platform/fileSystem';
import { FileType, IFileSystemPathUtils, TemporaryFile } from '../common/platform/types';
import { IDataScienceFileSystem } from './types';

export const ENCODING = 'utf8';

/**
 * File system abstraction which wraps the VS Code API.
 */
@injectable()
export class DataScienceFileSystem implements IDataScienceFileSystem {
    private globFiles: (pat: string, options?: { cwd: string; dot?: boolean }) => Promise<string[]>;

    constructor(@inject(IFileSystemPathUtils) private fsPathUtils: IFileSystemPathUtils) {
        this.globFiles = promisify(glob);
    }

    public async appendLocalFile(path: string, text: string): Promise<void> {
        return fs.appendFile(path, text);
    }

    public arePathsSame(path1: string, path2: string): boolean {
        return this.fsPathUtils.arePathsSame(path1, path2);
    }

    public async createLocalDirectory(path: string): Promise<void> {
        await this.createDirectory(Uri.file(path));
    }

    public createLocalWriteStream(path: string): fs.WriteStream {
        return fs.createWriteStream(path);
    }

    public async copyLocal(source: string, destination: string): Promise<void> {
        const srcUri = Uri.file(source);
        const dstUri = Uri.file(destination);
        await workspace.fs.copy(srcUri, dstUri, { overwrite: true });
    }

    public async createTemporaryLocalFile(suffix: string, mode?: number): Promise<TemporaryFile> {
        const opts = {
            postfix: suffix,
            mode
        };
        return new Promise<TemporaryFile>((resolve, reject) => {
            tmp.file(opts, (err, filename, _fd, cleanUp) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    filePath: filename,
                    dispose: cleanUp
                });
            });
        });
    }

    public async deleteLocal(path: string, options?: { recursive: boolean; useTrash: boolean }): Promise<void> {
        const uri = Uri.file(path);
        return workspace.fs.delete(uri, options);
    }

    public getDisplayName(filename: string, cwd?: string): string {
        return this.fsPathUtils.getDisplayName(filename, cwd);
    }

    public async getFileHash(filename: string): Promise<string> {
        // The reason for lstat rather than stat is not clear...
        const stat = await this.lstat(filename);
        const data = `${stat.ctime}-${stat.mtime}`;
        return getHashString(data);
    }

    public async localPathExists(path: string): Promise<boolean> {
        return fs.pathExists(path);
    }

    public async readLocalData(filename: string): Promise<Buffer> {
        const uri = Uri.file(filename);
        const data = await workspace.fs.readFile(uri);
        return Buffer.from(data);
    }

    public async readLocalFile(filename: string): Promise<string> {
        const uri = Uri.file(filename);
        const result = await workspace.fs.readFile(uri);
        const data = Buffer.from(result);
        return data.toString(ENCODING);
    }

    public async searchLocal(globPattern: string, cwd?: string, dot?: boolean): Promise<string[]> {
        // tslint:disable-next-line: no-any
        let options: any;
        if (cwd) {
            options = { ...options, cwd };
        }
        if (dot) {
            options = { ...options, dot };
        }

        const found = await this.globFiles(globPattern, options);
        return Array.isArray(found) ? found : [];
    }

    public async writeLocalFile(filename: string, text: string | Buffer): Promise<void> {
        const uri = Uri.file(filename);
        const data = typeof text === 'string' ? Buffer.from(text) : text;
        await workspace.fs.writeFile(uri, data);
    }

    // URI-based filesystem functions for interacting with files provided by VS Code
    public async copy(source: Uri, destination: Uri): Promise<void> {
        await workspace.fs.copy(source, destination);
    }

    public async createDirectory(uri: Uri): Promise<void> {
        await workspace.fs.createDirectory(uri);
    }

    public async delete(uri: Uri): Promise<void> {
        await workspace.fs.delete(uri);
    }

    public async readFile(uri: Uri): Promise<string> {
        const result = await workspace.fs.readFile(uri);
        const data = Buffer.from(result);
        return data.toString(ENCODING);
    }

    public async stat(uri: Uri): Promise<FileStat> {
        return workspace.fs.stat(uri);
    }

    public async writeFile(uri: Uri, text: string | Buffer): Promise<void> {
        const data = typeof text === 'string' ? Buffer.from(text) : text;
        await workspace.fs.writeFile(uri, data);
    }

    private async lstat(filename: string): Promise<FileStat> {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO https://github.com/microsoft/vscode/issues/71204 (84514)):
        //   This functionality has been requested for the VS Code API.
        const stat = await fs.lstat(filename);
        // Note that, unlike stat(), lstat() does not include the type
        // of the symlink's target.
        const fileType = convertFileType(stat);
        return convertStat(stat, fileType);
    }
}

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
