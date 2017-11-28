import { commands, Disposable } from 'vscode';
import { IFeatureDeprecationManager } from '../common/featureDeprecationManager';
import { deprecatedCommands } from './constants';

export class Jupyter implements Disposable {
    private disposables: Disposable[];
    constructor(private deprecationManager: IFeatureDeprecationManager) {
        this.registerCommands();
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private registerCommands() {
        deprecatedCommands.forEach(cmd => {
            this.disposables.push(commands.registerCommand(cmd, this.displayDeprecatedMessage, this));
        });
    }
    private displayDeprecatedMessage() {
        this.deprecationManager.notifyDeprecationOfJupyter();
    }
}
