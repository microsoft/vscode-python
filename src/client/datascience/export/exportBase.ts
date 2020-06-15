import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IPythonDaemonExecutionService, IPythonExecutionFactory } from '../../common/process/types';
import { JupyterDaemonModule } from '../constants';
import { IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { IExport } from './types';

@injectable()
export class ExportBase implements IExport {
    constructor(
        @inject(IPythonExecutionFactory) protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IJupyterSubCommandExecutionService)
        protected jupyterService: IJupyterSubCommandExecutionService,
        @inject(IFileSystem) protected readonly fileSystem: IFileSystem,
        @inject(INotebookImporter) protected readonly importer: INotebookImporter
    ) {}

    public async export(_source: Uri, _target: Uri): Promise<void> {
        return;
    }

    protected async getDaemon(): Promise<IPythonDaemonExecutionService | undefined> {
        const interpreter = await this.jupyterService.getSelectedInterpreter();
        if (!interpreter) {
            return;
        }

        return this.pythonExecutionFactory.createDaemon<IPythonDaemonExecutionService>({
            daemonModule: JupyterDaemonModule,
            pythonPath: interpreter.path
        });
    }

    protected async writeFile(file: Uri, content: string): Promise<void> {
        await this.fileSystem.writeFile(file.fsPath, content, { encoding: 'utf-8' });
    }
}
