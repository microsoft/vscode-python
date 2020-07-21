import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { extensions } from 'vscode';
import { concatMultilineStringInput } from '../../../datascience-ui/common';
import { IConfigurationService, IExtensionContext } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { CellMatcher } from '../cellMatcher';
import { GatherExtension, Telemetry } from '../constants';
import { ICell as IVscCell, IGatherLogger, IGatherProvider } from '../types';

@injectable()
export class GatherLogger implements IGatherLogger {
    private gather: IGatherProvider | undefined;
    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IExtensionContext) private context: IExtensionContext
    ) {
        this.initGatherExtension().ignoreErrors();
    }

    public dispose() {
        noop();
    }
    public onKernelRestarted() {
        noop();
    }

    public async preExecute(_vscCell: IVscCell, _silent: boolean): Promise<void> {
        // This function is just implemented here for compliance with the INotebookExecutionLogger interface
        noop();
    }

    public async postExecute(vscCell: IVscCell, _silent: boolean): Promise<void> {
        if (this.gather) {
            // Don't log if vscCell.data.source is an empty string or if it was
            // silently executed. Original Jupyter extension also does this.
            if (vscCell.data.source !== '' && !_silent) {
                // First make a copy of this cell, as we are going to modify it
                const cloneCell: IVscCell = cloneDeep(vscCell);

                // Strip first line marker. We can't do this at JupyterServer.executeCodeObservable because it messes up hashing
                const cellMatcher = new CellMatcher(this.configService.getSettings().datascience);
                cloneCell.data.source = cellMatcher.stripFirstMarker(concatMultilineStringInput(vscCell.data.source));

                this.gather.logExecution(cloneCell);

                // We save the amount lines the code had before gathering for telemetry purposes.
                let gatherCount: number | undefined = this.context.globalState.get('gatherCount');

                if (gatherCount) {
                    gatherCount += vscCell.data.source.length;
                    this.context.globalState.update('gatherCount', gatherCount);
                } else {
                    this.context.globalState.update('gatherCount', 0);
                }
            }
        }
    }

    public getGatherProvider(): IGatherProvider | undefined {
        return this.gather;
    }

    private async initGatherExtension() {
        const ext = extensions.getExtension(GatherExtension);
        if (ext) {
            sendTelemetryEvent(Telemetry.GatherIsInstalled);
            if (!ext.isActive) {
                await ext.activate();
            }
            const api = ext.exports;

            this.gather = api.getGatherProvider();
        }
    }
}
