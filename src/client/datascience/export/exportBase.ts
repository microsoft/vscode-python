import { inject, injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
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
    public async export(_source: Uri, _target: Uri, _token: CancellationToken): Promise<void> {}

    @reportAction(ReportableAction.PerformingExport)
    public async executeCommand(source: Uri, target: Uri, args: string[], token: CancellationToken): Promise<void> {
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

        const oldFileExists = await this.fileSystem.fileExists(target.fsPath);
        let oldFileTime;
        let oldFileContents;
        if (oldFileExists) {
            oldFileContents = await this.fileSystem.readFile(target.fsPath);
            oldFileTime = (await this.fileSystem.stat(target.fsPath)).mtime;
        }

        if (token.isCancellationRequested) {
            return;
        }

        const result = await service.execModule('jupyter', ['nbconvert'].concat(args), {
            throwOnStdErr: false,
            encoding: 'utf8',
            token: token
        });

        if (token.isCancellationRequested) {
            if (oldFileExists) {
                const newFileTime = (await this.fileSystem.stat(target.fsPath)).mtime;
                if (newFileTime !== oldFileTime) {
                    // need to restore old file if it existed
                    await this.fileSystem.deleteFile(target.fsPath);
                    if (oldFileContents) {
                        await this.fileSystem.writeFile(target.fsPath, oldFileContents);
                    }
                }
            } else {
                try {
                    await this.fileSystem.deleteFile(target.fsPath);
                    // tslint:disable-next-line: no-empty
                } catch {}
            }
            return;
        }

        // Need to check if export failed, since throwOnStdErr is not an
        // indicator of a failed export.
        if (!(await this.fileSystem.fileExists(target.fsPath))) {
            throw new Error(result.stderr);
        } else if (oldFileExists) {
            // If we exported to a file that already exists we need to check that
            // this file was actually overridden during export
            const newFileTime = (await this.fileSystem.stat(target.fsPath)).mtime;
            if (newFileTime === oldFileTime) {
                throw new Error(result.stderr);
            }
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
