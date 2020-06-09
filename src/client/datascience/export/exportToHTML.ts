import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToHTML extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        source = target; // stop compilier from getting mad REMOVE
        target = source;
    }
}
