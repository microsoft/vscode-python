import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPDF extends ExportBase {
    // tslint:disable-next-line: no-empty
    public async export(_source: Uri, _target: Uri): Promise<void> {}
}
