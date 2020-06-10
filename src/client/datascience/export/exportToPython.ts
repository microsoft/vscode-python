import { inject, injectable } from 'inversify';
import { Uri, ViewColumn } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { INotebookEditorProvider, INotebookImporter } from '../types';
import { IExport } from './exportManager';

@injectable()
export class ExportToPython implements IExport {
    constructor(
        @inject(INotebookEditorProvider) protected readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter
    ) {}

    public async export(source: Uri): Promise<void> {
        const contents = await this.importer.importFromFile(
            source.fsPath,
            this.notebookEditorProvider.activeEditor?.file.fsPath
        );
        if (contents) {
            await this.viewDocument(contents);
        }
    }

    private async viewDocument(contents: string): Promise<void> {
        const doc = await this.documentManager.openTextDocument({ language: 'python', content: contents });
        await this.documentManager.showTextDocument(doc, ViewColumn.One);
    }
}
