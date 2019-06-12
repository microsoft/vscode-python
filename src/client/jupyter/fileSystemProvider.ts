import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { JupyterNotebook } from './jupyterNotebookSchema';

declare module 'fs-extra' { // supplement fs-extra with missing overload

    // tslint:disable-next-line: interface-name
    interface Dirent {
        name: string;
        isFile(): boolean;
        isDirectory(): boolean;
        isBlockDevice(): boolean;
        isCharacterDevice(): boolean;
        isSymbolicLink(): boolean;
        isFIFO(): boolean;
        isSocket(): boolean;
    }
    type PathLike = string | Buffer | URL;

    function readdir(path: PathLike, options: { withFileTypes: true }, callback: (err: NodeJS.ErrnoException | null, files: Dirent[]) => void): void;
}

function convertFileType(fileStat: { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }): vscode.FileType {
    return fileStat.isDirectory() ? vscode.FileType.Directory :
        fileStat.isFile() ? vscode.FileType.File :
            fileStat.isSymbolicLink() ? vscode.FileType.SymbolicLink :
                vscode.FileType.Unknown;
}

function handleError(err: NodeJS.ErrnoException | null): void {
    if (err) {
        switch (err.code) {
            case 'ENOENT': throw vscode.FileSystemError.FileNotFound(err.message);
            default: throw new vscode.FileSystemError(err.toString());
        }
    }
}

export class JupyterFileSystem implements vscode.FileSystemProvider {
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle: NodeJS.Timer | undefined;

    // tslint:disable-next-line: member-ordering
    public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    public static uriForDirectory(dirUri: vscode.Uri) {
        const uri = `jupyterfs:/${dirUri.path}`;
        return vscode.Uri.parse(uri);
    }

    public stat(uri: vscode.Uri): Thenable<vscode.FileStat> {
        return new Promise((cont, _) =>
            fs.stat(uri.path, (errno, fileStat) =>
                errno ? handleError(errno) :
                    cont({
                        ctime: fileStat.ctime.getUTCMilliseconds(),
                        mtime: fileStat.mtime.getUTCMilliseconds(),
                        size: fileStat.size,
                        type: convertFileType(fileStat)
                    })));
    }

    public readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]> {
        return new Promise((cont, _) =>
            fs.readdir(uri.path, { withFileTypes: true }, (errno, dirents) =>
                errno ? handleError(errno) :
                    cont(dirents.map(dirent => [dirent.name, convertFileType(dirent)]))));
    }

    public createDirectory(uri: vscode.Uri): Thenable<void> {
        return new Promise((cont, _) => {
            fs.mkdir(uri.path, handleError);
            cont();
        });
    }

    public readFile(uri: vscode.Uri): Thenable<Uint8Array> {
        if (uri.path.indexOf('/.vscode/') > 0) { throw vscode.FileSystemError.FileNotFound(uri); }
        const ext = path.extname(path.posix.basename(uri.path));
        function read(data: Buffer) {
            if (ext !== '.ipynb') { return data; }
            const nb = JSON.parse(data.toString()) as JupyterNotebook;
            let text = '';
            nb.cells.forEach(cell => {
                text += `#%%\n${cell.source.join('')}\n`;
            });
            return new Buffer(text);
        }
        return new Promise((cont, _) =>
            fs.readFile(uri.path, (errno, data) =>
                errno ? handleError(errno) : cont(read(data))));
    }

    public writeFile(uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean }): Thenable<void> {
        // const ext = path.extname(path.posix.basename(uri.path));
        throw new Error('Method not implemented.');
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    public delete(uri: vscode.Uri, _options: { recursive: boolean }): Thenable<void> {
        return new Promise((_cont, _err) => {
            fs.unlink(uri.path, handleError);
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri: uri }, { uri, type: vscode.FileChangeType.Deleted });
            _cont();
        });
    }

    public rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean }): Thenable<void> {
        return new Promise((_cont, _err) => {
            fs.rename(oldUri.path, newUri.path, handleError);
            this._fireSoon(
                { type: vscode.FileChangeType.Deleted, uri: oldUri },
                { type: vscode.FileChangeType.Created, uri: newUri }
            );
            _cont();
        });
    }

    public watch(_resource: vscode.Uri, _opts: { recursive: boolean; excludes: string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        // tslint:disable-next-line: no-empty
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);
        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }
        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }

}
