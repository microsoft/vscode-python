import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { INotebookImporter } from '../types';
import { IExport } from './exportManager';

@injectable()
export class ExportToPython implements IExport {
    constructor(
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter
    ) {}

    public async export(source: Uri, target: Uri): Promise<void> {
        const contents = await this.importer.importFromFile(source.fsPath);
        try {
            await this.fileSystem.writeFile(target.fsPath, contents);
        } catch {
            throw new Error('Unable to export file.');
        }
    }
}
