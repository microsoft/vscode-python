// tslint:disable:no-require-imports no-var-requires underscore-consistent-invocation
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IRegistry, RegistryHive } from '../../../common/platform/types';
import { IPathUtils, Is64Bit } from '../../../common/types';
import { Architecture } from '../../../common/utils/platform';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterHelper, InterpreterType, PythonInterpreter } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName, AnacondaCompanyNames } from './conda';
const flatten = require('lodash/flatten') as typeof import('lodash/flatten');

// tslint:disable-next-line:variable-name
const DefaultPythonExecutable = 'python.exe';
// tslint:disable-next-line:variable-name
const CompaniesToIgnore = ['PYLAUNCHER'];
// tslint:disable-next-line:variable-name
const PythonCoreCompanyDisplayName = 'Python Software Foundation';
// tslint:disable-next-line:variable-name
const PythonCoreComany = 'PYTHONCORE';

type CompanyInterpreter = {
    companyKey: string;
    hive: RegistryHive;
    arch?: Architecture;
};

@injectable()
export class WindowsRegistryService extends CacheableLocatorService {
    private readonly pathUtils: IPathUtils;
    constructor(@inject(IRegistry) private registry: IRegistry,
        @inject(Is64Bit) private is64Bit: boolean,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('WindowsRegistryService', serviceContainer);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.getInterpretersFromRegistry();
    }
    private async getInterpretersFromRegistry() {
        // https://github.com/python/peps/blob/master/pep-0514.txt#L357
        const hkcuArch = this.is64Bit ? undefined : Architecture.x86;
        const promises: Promise<CompanyInterpreter[]>[] = [
            this.getCompanies(RegistryHive.HKCU, hkcuArch),
            this.getCompanies(RegistryHive.HKLM, Architecture.x86)
        ];
        // https://github.com/Microsoft/PTVS/blob/ebfc4ca8bab234d453f15ee426af3b208f3c143c/Python/Product/Cookiecutter/Shared/Interpreters/PythonRegistrySearch.cs#L44
        if (this.is64Bit) {
            promises.push(this.getCompanies(RegistryHive.HKLM, Architecture.x64));
        }

        const companies = await Promise.all<CompanyInterpreter[]>(promises);
        const companyInterpreters = await Promise.all(flatten(companies)
            .filter(item => item !== undefined && item !== null)
            .map(company => {
                return this.getInterpretersForCompany(company.companyKey, company.hive, company.arch);
            }));

        return flatten(companyInterpreters)
            .filter(item => item !== undefined && item !== null)
            // tslint:disable-next-line:no-non-null-assertion
            .map(item => item!)
            .reduce<PythonInterpreter[]>((prev, current) => {
                if (prev.findIndex(item => item.path.toUpperCase() === current.path.toUpperCase()) === -1) {
                    prev.push(current);
                }
                return prev;
            }, []);
    }
    private async getCompanies(hive: RegistryHive, arch?: Architecture): Promise<CompanyInterpreter[]> {
        return this.registry.getKeys('\\Software\\Python', hive, arch)
            .then(companyKeys => companyKeys
                .filter(companyKey => CompaniesToIgnore.indexOf(this.pathUtils.basename(companyKey).toUpperCase()) === -1)
                .map(companyKey => {
                    return { companyKey, hive, arch };
                }));
    }
    private async getInterpretersForCompany(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const tagKeys = await this.registry.getKeys(companyKey, hive, arch);
        return Promise.all(tagKeys.map(tagKey => this.getInreterpreterDetailsForCompany(tagKey, companyKey, hive, arch)));
    }
    private getInreterpreterDetailsForCompany(tagKey: string, companyKey: string, hive: RegistryHive, arch?: Architecture): Promise<PythonInterpreter | undefined | null> {
        const key = `${tagKey}\\InstallPath`;
        type InterpreterInformation = null | undefined | {
            installPath: string;
            executablePath?: string;
            displayName?: string;
            version?: string;
            companyDisplayName?: string;
        };
        return this.registry.getValue(key, hive, arch)
            .then(installPath => {
                // Install path is mandatory.
                if (!installPath) {
                    return Promise.resolve(null);
                }
                // Check if 'ExecutablePath' exists.
                // Remember Python 2.7 doesn't have 'ExecutablePath' (there could be others).
                // Treat all other values as optional.
                return Promise.all([
                    Promise.resolve(installPath),
                    this.registry.getValue(key, hive, arch, 'ExecutablePath'),
                    this.registry.getValue(tagKey, hive, arch, 'SysVersion'),
                    this.getCompanyDisplayName(companyKey, hive, arch)
                ])
                    .then(([installedPath, executablePath, version, companyDisplayName]) => {
                        companyDisplayName = AnacondaCompanyNames.indexOf(companyDisplayName) === -1 ? companyDisplayName : AnacondaCompanyName;
                        // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
                        return { installPath: installedPath, executablePath, version, companyDisplayName } as InterpreterInformation;
                    });
            })
            .then(async (interpreterInfo?: InterpreterInformation) => {
                if (!interpreterInfo) {
                    return;
                }

                const executablePath = interpreterInfo.executablePath && interpreterInfo.executablePath.length > 0 ? interpreterInfo.executablePath : path.join(interpreterInfo.installPath, DefaultPythonExecutable);
                const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
                const details = await helper.getInterpreterInformation(executablePath);
                if (!details) {
                    return;
                }
                const version = interpreterInfo.version ? this.pathUtils.basename(interpreterInfo.version) : this.pathUtils.basename(tagKey);
                // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
                return {
                    ...(details as PythonInterpreter),
                    path: executablePath,
                    version,
                    companyDisplayName: interpreterInfo.companyDisplayName,
                    type: InterpreterType.Unknown
                } as PythonInterpreter;
            })
            .then(interpreter => interpreter ? fs.pathExists(interpreter.path).catch(() => false).then(exists => exists ? interpreter : null) : null)
            .catch(error => {
                console.error(`Failed to retrieve interpreter details for company ${companyKey},tag: ${tagKey}, hive: ${hive}, arch: ${arch}`);
                console.error(error);
                return null;
            });
    }
    private async  getCompanyDisplayName(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const displayName = await this.registry.getValue(companyKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
        const company = this.pathUtils.basename(companyKey);
        return company.toUpperCase() === PythonCoreComany ? PythonCoreCompanyDisplayName : company;
    }
}
