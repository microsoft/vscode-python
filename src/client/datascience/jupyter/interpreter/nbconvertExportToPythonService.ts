// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { traceError } from '../../../common/logger';

import { IPythonDaemonExecutionService, IPythonExecutionFactory } from '../../../common/process/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { JupyterDaemonModule } from '../../constants';
import { reportAction } from '../../progress/decorator';
import { ReportableAction } from '../../progress/types';

@injectable()
export class NbConvertExportToPythonService {
    constructor(@inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory) {}

    @reportAction(ReportableAction.ExportNotebookToPython)
    public async exportNotebookToPython(
        file: Uri,
        interpreter: PythonEnvironment,
        template?: string,
        token?: CancellationToken
    ): Promise<string> {
        const daemon = await this.pythonExecutionFactory.createDaemon<IPythonDaemonExecutionService>({
            daemonModule: JupyterDaemonModule,
            pythonPath: interpreter.path
        });
        // Wait for the nbconvert to finish
        const args = template
            ? [file.fsPath, '--to', 'python', '--stdout', '--template', template]
            : [file.fsPath, '--to', 'python', '--stdout'];

        // Ignore stderr, as nbconvert writes conversion result to stderr.
        // stdout contains the generated python code.
        return daemon
            .execModule('jupyter', ['nbconvert'].concat(args), { throwOnStdErr: false, encoding: 'utf8', token })
            .then((output) => {
                // We can't check stderr (as nbconvert puts diag output there) but we need to verify here that we actually
                // converted something. If it's zero size then just raise an error
                if (output.stdout === '') {
                    traceError('nbconvert zero size output');
                    throw new Error(output.stderr);
                } else {
                    return output.stdout;
                }
            });
    }
}
