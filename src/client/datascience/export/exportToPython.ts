import { injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public async export(source: Uri, target: Uri, token: CancellationToken): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }
        const contents = await this.importer.importFromFile(source.fsPath);
        await this.fileSystem.writeFile(target.fsPath, contents);
    }
}
