import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { INotebookEditorProvider, INotebookImporter } from '../types';

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target: Uri): Promise<void>;
}

@injectable()
export abstract class ExportBase implements IExport {
    constructor(
        @inject(INotebookEditorProvider) protected readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter
    ) {}

    public async export(source: Uri, target: Uri): Promise<void> {
        source = target; // prevent compilier from getting mad REMOVE
        target = source;
    }
}
