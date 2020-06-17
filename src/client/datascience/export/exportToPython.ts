import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        const contents = await this.importer.importFromFile(source.fsPath);
        await this.fileSystem.writeFile(target.fsPath, contents);
    }
}
