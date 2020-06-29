import { Uri } from 'vscode';
import { INotebookModel } from '../types';

export enum ExportFormat {
    pdf = 'pdf',
    html = 'html',
    python = 'python'
}

export const IExportManager = Symbol('IExportManager');
export interface IExportManager {
    export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined>;
}

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target: Uri): Promise<void>;
}

export const IExportManagerFilePicker = Symbol('IExportManagerFilePicker');
export interface IExportManagerFilePicker {
    getExportFileLocation(format: ExportFormat, source: Uri): Promise<Uri | undefined>;
}
