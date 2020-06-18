import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';
import { IApplicationShell } from '../../common/application/types';
import * as localize from '../../common/utils/localize';
import { IJupyterExecution, IJupyterInterpreterDependencyManager, INotebookModel } from '../types';
import { ExportManager } from './exportManager';
import { ExportFormat, IExportManager } from './types';

@injectable()
export class ExportManagerDependencyChecker implements IExportManager {
    constructor(
        @inject(ExportManager) private readonly manager: IExportManager,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IJupyterInterpreterDependencyManager)
        private readonly dependencyManager: IJupyterInterpreterDependencyManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        // Before we try the import, see if we don't support it, if we don't give a chance to install dependencies
        if (format === ExportFormat.pdf) {
            // special dependicies for pdf
            if (await this.askInstallPDFDependicies()) {
                await this.installPDFDependicies();
            }
        }

        if (!(await this.jupyterExecution.isImportSupported())) {
            await this.dependencyManager.installMissingDependencies();
        }

        if (await this.jupyterExecution.isImportSupported()) {
            return this.manager.export(format, model);
        } else {
            throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
        }
    }

    public async askInstallPDFDependicies(): Promise<boolean> {
        const yes = getLocString('DataScience.installPDFDependiciesYes', 'Yes');
        const no = getLocString('DataScience.installPDFDependiciesNo', 'No');
        const items = [yes, no];

        const selected = await this.applicationShell
            .showInformationMessage(
                getLocString(
                    'DataScience.installPDFDependiciesMessage',
                    'To export this file we need to install the following dependicies...'
                ),
                ...items
            )
            .then((item) => item);

        return selected === yes;
    }

    // tslint:disable-next-line: no-empty
    public async installPDFDependicies(): Promise<void> {}
}
