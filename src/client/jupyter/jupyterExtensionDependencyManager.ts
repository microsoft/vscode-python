import { inject, injectable } from 'inversify';
import {
    IApplicationEnvironment,
    IApplicationShell,
    IJupyterExtensionDependencyManager,
} from '../common/application/types';
import { JUPYTER_EXTENSION_ID } from '../common/constants';
import { IExtensions } from '../common/types';
import { Common, Jupyter } from '../common/utils/localize';

@injectable()
export class JupyterExtensionDependencyManager implements IJupyterExtensionDependencyManager {
    constructor(
        @inject(IExtensions) private extensions: IExtensions,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IApplicationEnvironment) private appEnv: IApplicationEnvironment,
    ) {}

    public get isJupyterExtensionInstalled() {
        return this.extensions.getExtension(JUPYTER_EXTENSION_ID) !== undefined;
    }

    public async installJupyterExtension(): Promise<undefined> {
        const yes = Common.bannerLabelYes();
        const no = Common.bannerLabelNo();
        const answer = await this.appShell.showErrorMessage(Jupyter.jupyterExtensionRequired(), yes, no);
        if (answer === yes) {
            this.appShell.openUrl(`${this.appEnv.uriScheme}:extension/${JUPYTER_EXTENSION_ID}`);
        }
        return undefined;
    }
}
