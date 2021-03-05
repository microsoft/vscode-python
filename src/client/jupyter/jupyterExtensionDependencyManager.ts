import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager, IJupyterExtensionDependencyManager } from '../common/application/types';
import { JUPYTER_EXTENSION_ID } from '../common/constants';
import { IExtensions } from '../common/types';
import { Common, Jupyter } from '../common/utils/localize';

@injectable()
export class JupyterExtensionDependencyManager implements IJupyterExtensionDependencyManager {
    constructor(
        @inject(IExtensions) private extensions: IExtensions,
        @inject(IApplicationShell) private appShell: IApplicationShell,
    ) {}

    public get isJupyterExtensionInstalled(): boolean {
        return this.extensions.getExtension(JUPYTER_EXTENSION_ID) !== undefined;
    }

    public async installJupyterExtension(commandManager: ICommandManager): Promise<undefined> {
        const yes = Common.bannerLabelYes();
        const no = Common.bannerLabelNo();
        const answer = await this.appShell.showErrorMessage(Jupyter.jupyterExtensionRequired(), yes, no);
        if (answer === yes) {
            commandManager.executeCommand('extension.open', JUPYTER_EXTENSION_ID);
        }
        return undefined;
    }
}
