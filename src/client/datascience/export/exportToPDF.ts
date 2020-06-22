import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { DataScience } from '../../common/utils/localize';
import { IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPDF extends ExportBase {
    constructor(
        @inject(IPythonExecutionFactory) protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IJupyterSubCommandExecutionService)
        protected jupyterService: IJupyterSubCommandExecutionService,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell
    ) {
        super(pythonExecutionFactory, jupyterService, fileSystem, importer);
    }

    public async export(source: Uri, target: Uri): Promise<void> {
        const args = [
            source.fsPath,
            '--to',
            'pdf',
            '--output',
            path.basename(target.fsPath),
            '--output-dir',
            path.dirname(target.fsPath)
        ];
        try {
            await this.executeCommand(source, target, args);
        } catch (e) {
            this.displayInstallDependency().then().catch();
            throw e;
        }
    }

    public async displayInstallDependency() {
        // TeX is a dependency of exporting to PDF, user must install this.
        await this.applicationShell.showWarningMessage(DataScience.markdownExportToPDFDependencyMessage());
    }
}
