import { injectable } from 'inversify';
import { Uri } from 'vscode';
//import { INotebookImporter } from '../types';

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target: Uri): Promise<void>;
}

@injectable()
export abstract class ExportBase implements IExport {
    public async export(source: Uri, target: Uri): Promise<void> {
        console.log(source, target);
    }
}
