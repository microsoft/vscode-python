import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { INotebookEditor } from '../types';
import { ExportFormat, IExportManager } from './exportManager';
import { ExportManagerDependencyChecker } from './exportManagerDependencyChecker';

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(@inject(ExportManagerDependencyChecker) private readonly manager: IExportManager) {}

    public async export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined> {
        const uri = await this.manager.export(format, activeEditor);

        // open the file.
        return uri;
    }
}
