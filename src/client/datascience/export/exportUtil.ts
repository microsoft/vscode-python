import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';

@injectable()
export class ExportUtil {
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

    public async createUniqueDirectoryPath(): Promise<string> {
        const tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
        const filePath = tempFile.filePath;
        const dirPath = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)));
        tempFile.dispose();
        return dirPath;
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
