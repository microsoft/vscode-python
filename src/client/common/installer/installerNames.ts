
export enum Installer {
    PipInstaller = 1,
    CondaInstaller = 2,
    PipEnvInstaller = 3,
    PoetryInstaller = 4
}
export const InstallerNames = new Map<Installer, string>();
InstallerNames.set(Installer.PipInstaller, 'Pip');
InstallerNames.set(Installer.CondaInstaller, 'Conda');
InstallerNames.set(Installer.PipEnvInstaller, 'pipenv');
InstallerNames.set(Installer.PoetryInstaller, 'poetry');
