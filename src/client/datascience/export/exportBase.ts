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
    public async executeCommand(source: Uri, args: string[]): Promise<void> {
        const service = await this.getExecutionService(source);
        if (!service) {
            return;
        }
        await service.execModule('jupyter', ['nbconvert'].concat(args), { throwOnStdErr: false, encoding: 'utf8' });
    }

    protected async getExecutionService(source: Uri): Promise<IPythonExecutionService | undefined> {
        return this.pythonExecutionFactory.createActivatedEnvironment({
            resource: source,
            allowEnvironmentFetchExceptions: false,
            bypassCondaExecution: true
        });
    }
}
