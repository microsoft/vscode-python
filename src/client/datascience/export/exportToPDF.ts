import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPDF extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        console.log(source, target);
    }
}
