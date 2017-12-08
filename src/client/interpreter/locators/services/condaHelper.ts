import { AnacondaDisplayName, AnacondaIdentfiers, CondaInfo } from './conda';

export class CondaHelper {
    public getDisplayName(condaInfo: CondaInfo = {}): string {
        // Samples.
        // "3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]".
        // "3.6.2 |Anaconda, Inc.| (default, Sep 21 2017, 18:29:43) \n[GCC 4.2.1 Compatible Clang 4.0.1 (tags/RELEASE_401/final)]".
        const sysVersion = condaInfo['sys.version'];
        if (!sysVersion) {
            return AnacondaDisplayName;
        }

        // Take the second part of the sys.version.
        const sysVersionParts = sysVersion.split('|', 2);
        if (sysVersionParts.length === 2) {
            const displayName = sysVersionParts[1].trim();
            return this.isIdentifiableAsAnaconda(displayName) ? displayName : `${displayName} : ${AnacondaDisplayName}`;
        } else {
            return AnacondaDisplayName;
        }
    }
    private isIdentifiableAsAnaconda(value: string) {
        const valueToSearch = value.toLowerCase();
        return AnacondaIdentfiers.some(item => valueToSearch.indexOf(item.toLowerCase()) !== -1);
    }
    private getPythonVersion(condaInfo: CondaInfo): string | undefined {
        // Sample.
        // 3.6.2.final.0 (hence just take everything untill the third period).
        const pythonVersion = condaInfo.python_version;
        if (!pythonVersion) {
            return undefined;
        }
        return pythonVersion.split('.').filter((_, index) => index < 3).join('.');
    }
}
