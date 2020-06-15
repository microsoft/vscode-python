import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExport } from './types';

@injectable()
export class ExportToPDF implements IExport {
    // tslint:disable-next-line: no-empty
    public async export(_source: Uri, _target: Uri): Promise<void> {}
}
