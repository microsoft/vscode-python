import { inject, injectable } from 'inversify';
import { Uri, ViewColumn } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { INotebookModel } from '../types';
import { ExportFormat, IExportManager } from './exportManager';
import { ExportManagerDependencyChecker } from './exportManagerDependencyChecker';

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(
        @inject(ExportManagerDependencyChecker) private readonly manager: IExportManager,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        const uri = await this.manager.export(format, model);
        if (!uri) {
            return;
        }
        const contents = await this.fileSystem.readFile(uri.fsPath);
        await this.viewDocument(contents);
        return uri;
    }

    private async viewDocument(contents: string): Promise<void> {
        const doc = await this.documentManager.openTextDocument({ content: contents });
        await this.documentManager.showTextDocument(doc, ViewColumn.One);
    }
}
