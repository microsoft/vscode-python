import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { DataScience } from '../../common/utils/localize';
import { IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPDF extends ExportBase {
    constructor(
        @inject(IPythonExecutionFactory) protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IJupyterSubCommandExecutionService)
        protected jupyterService: IJupyterSubCommandExecutionService,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell
    ) {
        super(pythonExecutionFactory, jupyterService, fileSystem, importer);
    }

    public async export(source: Uri, target: Uri): Promise<void> {
        const directoryPath = path.join(
            path.dirname(source.fsPath),
            path.basename(source.fsPath, path.extname(source.fsPath))
        ); // since the source is a temporary file we know its name will be unique
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
        } catch (e) {
            await this.applicationShell.showInformationMessage(DataScience.markdownExportToPDFDependencyMessage());
            throw e;
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
            const content = await this.fileSystem.readFile(source.fsPath);
            const newFilePath = path.join(dirPath, newName);
            await this.fileSystem.writeFile(newFilePath, content);
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
