import { inject, injectable } from 'inversify';
import * as localize from '../../common/utils/localize';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { JupyterInterpreterService } from '../jupyter/interpreter/jupyterInterpreterService';
import { ProgressReporter } from '../progress/progressReporter';
import { IJupyterInterpreterDependencyManager, INbConvertInterpreterDependencyChecker } from '../types';
import { ExportFormat } from './types';

@injectable()
export class ExportInterpreterFinder {
    constructor(
        @inject(IJupyterInterpreterDependencyManager)
        private readonly dependencyManager: IJupyterInterpreterDependencyManager,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(INbConvertInterpreterDependencyChecker)
        private readonly nbConvertDependencyChecker: INbConvertInterpreterDependencyChecker,
        @inject(JupyterInterpreterService) private readonly jupyterInterpreterService: JupyterInterpreterService
    ) {}

    // For the given ExportFormat and a possible candidateInterpreter return an interpreter capable of running nbconvert or throw
    public async getExportInterpreter(
        format: ExportFormat,
        candidateInterpreter?: PythonEnvironment
    ): Promise<PythonEnvironment> {
        // Before we try the import, see if we don't support it, if we don't give a chance to install dependencies
        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`);
        try {
            // If an interpreter was passed in, first see if that interpreter supports NB Convert
            // if it does, we are good to go, but don't install nbconvert into it
            if (candidateInterpreter && (await this.checkNotebookInterpreter(candidateInterpreter))) {
                return candidateInterpreter;
            }

            // If an interpreter was not passed in, work with the main jupyter interperter
            const selectedJupyterInterpreter = await this.jupyterInterpreterService.getSelectedInterpreter();

            if (selectedJupyterInterpreter) {
                if (await this.checkNotebookInterpreter(selectedJupyterInterpreter)) {
                    return selectedJupyterInterpreter;
                } else {
                    // Give the user a chance to install nbconvert into the selected jupyter interpreter
                    await this.dependencyManager.installMissingDependencies();
                    if (await this.checkNotebookInterpreter(selectedJupyterInterpreter)) {
                        return selectedJupyterInterpreter;
                    }
                }
            }

            throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
        } finally {
            reporter.dispose();
        }
    }

    // For this specific interpreter associated with a notebook check to see if it supports import
    // and export with nbconvert
    private async checkNotebookInterpreter(interpreter: PythonEnvironment) {
        return this.nbConvertDependencyChecker.isNbConvertInstalled(interpreter);
    }
}
