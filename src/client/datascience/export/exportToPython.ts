import { injectable } from 'inversify';
import { Uri, ViewColumn } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
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
