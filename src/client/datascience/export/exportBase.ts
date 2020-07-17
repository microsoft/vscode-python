import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken, Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../common/process/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { IJupyterSubCommandExecutionService, INotebookImporter } from '../types';
import { ExportFormat, IExport } from './types';

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
    public async export(_source: Uri, _target: Uri, _token: CancellationToken): Promise<void> {}

    @reportAction(ReportableAction.PerformingExport)
    public async executeCommand(
        source: Uri,
        target: Uri,
        format: ExportFormat,
        token: CancellationToken
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }

        const service = await this.getExecutionService(source);
        if (!service) {
            return;
        }

        if (token.isCancellationRequested) {
            return;
        }

        const tempTarget = await this.fileSystem.createTemporaryFile(path.extname(target.fsPath));
        const args = [
            source.fsPath,
            '--to',
            format,
            '--output',
            path.basename(tempTarget.filePath),
            '--output-dir',
            path.dirname(tempTarget.filePath)
        ];
        const result = await service.execModule('jupyter', ['nbconvert'].concat(args), {
            throwOnStdErr: false,
            encoding: 'utf8',
            token: token
        });

        if (token.isCancellationRequested) {
            tempTarget.dispose();
            return;
        }

        try {
            await this.fileSystem.copyFile(tempTarget.filePath, target.fsPath);
        } catch {
            throw new Error(result.stderr);
        } finally {
            tempTarget.dispose();
        }
    }

    protected async getExecutionService(source: Uri): Promise<IPythonExecutionService | undefined> {
        const interpreter = await this.jupyterService.getSelectedInterpreter();
        if (!interpreter) {
            return;
        }
        return this.pythonExecutionFactory.createActivatedEnvironment({
            resource: source,
            interpreter,
            allowEnvironmentFetchExceptions: false,
            bypassCondaExecution: true
        });
    }
}
