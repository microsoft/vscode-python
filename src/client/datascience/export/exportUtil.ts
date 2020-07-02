import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IExportUtil } from './types';

@injectable()
export class ExportUtil implements IExportUtil {
    constructor(@inject(IFileSystem) private fileSystem: IFileSystem) {}

    public async createFileInDirectory(dirPath: string, fileName: string, source: Uri): Promise<string> {
        try {
            await this.fileSystem.createDirectory(dirPath);
            const newFilePath = path.join(dirPath, fileName);
            await this.fileSystem.copyFile(source.fsPath, newFilePath);
            return newFilePath;
        } catch (e) {
            await this.deleteDirectory(dirPath);
            throw e;
        }
    }

    public async deleteDirectory(dirPath: string) {
        if (!(await this.fileSystem.directoryExists(dirPath))) {
            return;
        }
        const files = await this.fileSystem.getFiles(dirPath);
        for (const file of files) {
            await this.fileSystem.deleteFile(file);
        }
        await this.fileSystem.deleteDirectory(dirPath);
    }
}
