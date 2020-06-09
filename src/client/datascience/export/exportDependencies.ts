import { injectable } from 'inversify';

export const IExportDependencies = Symbol('IExportDependencies');
export interface IExportDependencies {
    userHasDependencies(): Promise<boolean>;
    installDependecies(): Promise<void>;
}

@injectable()
export class ExportDependencies implements IExportDependencies {
    public async userHasDependencies(): Promise<boolean> {
        const juypterLab = await this.hasJuypterLab();
        const nbConvert = await this.hasNBConvert();
        return juypterLab && nbConvert;
    }

    public async installDependecies() {
        const juypterLab = await this.hasJuypterLab();
        if (!juypterLab) {
            await this.installJuypterLab();
        }
        const nbConvert = await this.hasNBConvert();
        if (!nbConvert) {
            await this.installNBConvert();
        }
    }

    private async hasJuypterLab(): Promise<boolean> {
        return false;
    }

    // tslint:disable-next-line: no-empty
    private async installJuypterLab(): Promise<void> {}

    private async hasNBConvert(): Promise<boolean> {
        return false;
    }

    // tslint:disable-next-line: no-empty
    private async installNBConvert(): Promise<void> {}
}
