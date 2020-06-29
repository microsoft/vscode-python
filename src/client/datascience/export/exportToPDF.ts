import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPDF extends ExportBase {
    constructor(
        @inject(IPythonExecutionFactory) protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IJupyterSubCommandExecutionService)
        protected jupyterService: IJupyterSubCommandExecutionService,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter
    ) {
        super(pythonExecutionFactory, jupyterService, fileSystem, importer);
    }

    public async export(source: Uri, target: Uri): Promise<void> {
        const tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
        const directoryPath = path.join(
            path.dirname(tempFile.filePath),
            path.basename(tempFile.filePath, path.extname(tempFile.filePath))
        );
        tempFile.dispose();
        const newFileName = path.basename(target.fsPath, path.extname(target.fsPath));
        const newSource = Uri.file(await this.createNewFile(directoryPath, newFileName, source));

        const args = [
            newSource.fsPath,
            '--to',
            'pdf',
            '--output',
            path.basename(target.fsPath),
            '--output-dir',
            path.dirname(target.fsPath)
        ];
        try {
            await this.executeCommand(newSource, target, args);
        } finally {
            await this.deleteNewDirectory(directoryPath);
        }
    }

    private async createNewFile(dirPath: string, newName: string, source: Uri): Promise<string> {
        // When exporting to PDF we need to change the source files name to match
        // what the title of the pdf should be.
        // To ensure the new file path is unique we will create a directory and
        // save the new file there
        try {
            await this.fileSystem.createDirectory(dirPath);
            const newFilePath = path.join(dirPath, newName);
            await this.fileSystem.copyFile(source.fsPath, newFilePath);
            return newFilePath;
        } catch (e) {
            await this.deleteNewDirectory(dirPath);
            throw e;
        }
    }

    private async deleteNewDirectory(dirPath: string) {
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
