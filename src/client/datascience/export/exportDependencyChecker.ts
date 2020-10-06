import { inject, injectable } from 'inversify';
import * as localize from '../../common/utils/localize';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ProgressReporter } from '../progress/progressReporter';
import { IJupyterExecution, IJupyterInterpreterDependencyManager } from '../types';
import { ExportFormat } from './types';

@injectable()
export class ExportDependencyChecker {
    constructor(
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IJupyterInterpreterDependencyManager)
        private readonly dependencyManager: IJupyterInterpreterDependencyManager,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter
    ) {}

    public async checkDependencies(format: ExportFormat, interpreter?: PythonEnvironment) {
        // Before we try the import, see if we don't support it, if we don't give a chance to install dependencies
        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`);
        try {
            if (!(await this.jupyterExecution.getImportPackageVersion())) {
                await this.dependencyManager.installMissingDependencies();
                if (!(await this.jupyterExecution.getImportPackageVersion())) {
                    throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
                }
            }
        } finally {
            reporter.dispose();
        }
    }

    // For this specific interpreter associated with a notebook check to see if it supports import
    // and export with nbconvert
    private async checkNotebookInterpreter(interpreter: PythonEnvironment) {}
}
