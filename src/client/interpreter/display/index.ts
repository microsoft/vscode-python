import { EOL } from 'os';
import * as path from 'path';
import { Disposable, StatusBarItem, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { IProcessService } from '../../common/process/types';
import * as utils from '../../common/utils';
import { IInterpreterLocatorService, IInterpreterVersionService } from '../contracts';
import { getActiveWorkspaceUri } from '../helpers';
import { IVirtualEnvironmentManager } from '../virtualEnvs/types';

// tslint:disable-next-line:completed-docs
export class InterpreterDisplay implements Disposable {
    constructor(private statusBar: StatusBarItem,
        private interpreterLocator: IInterpreterLocatorService,
        private virtualEnvMgr: IVirtualEnvironmentManager,
        private versionProvider: IInterpreterVersionService,
        private processService: IProcessService) {

        this.statusBar.command = 'python.setInterpreter';
    }
    public dispose() {
        //
    }
    public async refresh() {
        const wkspc = getActiveWorkspaceUri();
        if (!wkspc) {
            return;
        }
        const pythonPath = await this.getFullyQualifiedPathToInterpreter(PythonSettings.getInstance(wkspc.folderUri).pythonPath);
        await this.updateDisplay(pythonPath, wkspc.folderUri);
    }
    private async getInterpreters(resource?: Uri) {
        return this.interpreterLocator.getInterpreters(resource);
    }
    private async updateDisplay(pythonPath: string, resource?: Uri) {
        const interpreters = await this.getInterpreters(resource);
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, pythonPath));

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
    private async getFullyQualifiedPathToInterpreter(pythonPath: string) {
        return this.processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'])
            .then(output => output.stdout.trim())
            .then(value => value.length === 0 ? pythonPath : value)
            .catch(() => pythonPath);
    }
}
