import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../common/process/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
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

    // tslint:disable-next-line: no-empty
    public async export(_source: Uri, _target: Uri): Promise<void> {}

    @reportAction(ReportableAction.PerformingExport)
    public async executeCommand(source: Uri, target: Uri, args: string[]): Promise<void> {
        const service = await this.getExecutionService(source);
        if (!service) {
            return;
        }

        const oldFileExists = await this.fileSystem.fileExists(target.fsPath);
        let oldFileTime;
        if (oldFileExists) {
            oldFileTime = (await this.fileSystem.stat(target.fsPath)).mtime;
        }

        const result = await service.execModule('jupyter', ['nbconvert'].concat(args), {
            throwOnStdErr: false,
            encoding: 'utf8'
        });

        // Need to check if export failed, since throwOnStdErr is not an
        // indicator of a failed export.
        if (!(await this.fileSystem.fileExists(target.fsPath))) {
            throw new Error(result.stderr);
        } else if (oldFileExists) {
            // If we exported to a file that already exists we need to check that
            // this file was actually overriden during export
            const newFileTime = (await this.fileSystem.stat(target.fsPath)).mtime;
            if (newFileTime === oldFileTime) {
                throw new Error(result.stderr);
            }
        }
    }

    protected async getExecutionService(source: Uri): Promise<IPythonExecutionService | undefined> {
        return this.pythonExecutionFactory.createActivatedEnvironment({
            resource: source,
            allowEnvironmentFetchExceptions: false,
            bypassCondaExecution: true
        });
    }
}
