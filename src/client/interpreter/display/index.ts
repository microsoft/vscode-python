import { EOL } from 'os';
import * as path from 'path';
import { Disposable, StatusBarItem, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import * as utils from '../../common/utils';
import { IInterpreterService, IInterpreterVersionService } from '../contracts';
import { getActiveWorkspaceUri } from '../helpers';
import { IVirtualEnvironmentManager } from '../virtualEnvs/types';

// tslint:disable-next-line:completed-docs
export class InterpreterDisplay implements Disposable {
    constructor(private statusBar: StatusBarItem,
        private interpreterService: IInterpreterService,
        private virtualEnvMgr: IVirtualEnvironmentManager,
        private versionProvider: IInterpreterVersionService) {

        this.statusBar.command = 'python.setInterpreter';
    }
    public dispose() {
        //
    }
    public async refresh() {
        const wkspc = getActiveWorkspaceUri();
        await this.updateDisplay(wkspc ? wkspc.folderUri : undefined);
    }
    private async updateDisplay(resource?: Uri) {
        const interpreters = await this.interpreterService.getInterpreters(resource);
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const pythonPath = interpreter ? interpreter.path : PythonSettings.getInstance(resource).pythonPath;

        this.statusBar.color = '';
        this.statusBar.tooltip = pythonPath;
        if (interpreter) {
            // tslint:disable-next-line:no-non-null-assertion
            this.statusBar.text = interpreter.displayName!;
            if (interpreter.companyDisplayName) {
                const toolTipSuffix = `${EOL}${interpreter.companyDisplayName}`;
                this.statusBar.tooltip += toolTipSuffix;
            }
        } else {
            const defaultDisplayName = `${path.basename(pythonPath)} [Environment]`;
            await Promise.all([
                utils.fsExistsAsync(pythonPath),
                this.versionProvider.getVersion(pythonPath, defaultDisplayName),
                this.getVirtualEnvironmentName(pythonPath)
            ])
                .then(([interpreterExists, displayName, virtualEnvName]) => {
                    const dislayNameSuffix = virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';
                    this.statusBar.text = `${displayName}${dislayNameSuffix}`;

                    if (!interpreterExists && displayName === defaultDisplayName && interpreters.length > 0) {
                        this.statusBar.color = 'yellow';
                        this.statusBar.text = '$(alert) Select Python Environment';
                    }
                });
        }
        this.statusBar.show();
    }
    private async getVirtualEnvironmentName(pythonPath: string) {
        return this.virtualEnvMgr
            .detect(pythonPath)
            .then(env => env ? env.name : '');
    }
}
