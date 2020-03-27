// tslint:disable:no-require-imports no-var-requires underscore-consistent-invocation

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IFileSystem, IPlatformService, IRegistry, RegistryHive } from '../../../common/platform/types';
import { IPathUtils } from '../../../common/types';
import { Architecture } from '../../../common/utils/platform';
import { parsePythonVersion } from '../../../common/utils/version';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterHelper, InterpreterType, PythonInterpreter } from '../../contracts';
import { IWindowsStoreInterpreter } from '../types';
import { CacheableLocatorService } from './cacheableLocatorService';
import { AnacondaCompanyName, AnacondaCompanyNames } from './conda';
import { WindowsStoreInterpreter } from './windowsStoreInterpreter';
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
    private readonly fs: IFileSystem;
    constructor(
        @inject(IRegistry) private registry: IRegistry,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {
        super('WindowsRegistryService', serviceContainer);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    // tslint:disable-next-line:no-empty
    public dispose() {}
    protected async getInterpretersImplementation(_resource?: Uri): Promise<PythonInterpreter[]> {
        return this.platform.isWindows ? this.getInterpretersFromRegistry() : [];
    }
    private async getInterpretersFromRegistry() {
        // https://github.com/python/peps/blob/master/pep-0514.txt#L357
        const hkcuArch = this.platform.is64bit ? undefined : Architecture.x86;
        const promises: Promise<CompanyInterpreter[]>[] = [
            this.getCompanies(RegistryHive.HKCU, hkcuArch),
            this.getCompanies(RegistryHive.HKLM, Architecture.x86)
        ];
        // https://github.com/Microsoft/PTVS/blob/ebfc4ca8bab234d453f15ee426af3b208f3c143c/Python/Product/Cookiecutter/Shared/Interpreters/PythonRegistrySearch.cs#L44
        if (this.platform.is64bit) {
            promises.push(this.getCompanies(RegistryHive.HKLM, Architecture.x64));
        }

        const companies = await Promise.all<CompanyInterpreter[]>(promises);
        const companyInterpreters = await Promise.all(
            flatten(companies)
                .filter((item) => item !== undefined && item !== null)
                .map((company) => {
                    return this.getInterpretersForCompany(company.companyKey, company.hive, company.arch);
                })
        );

        return (
            flatten(companyInterpreters)
                .filter((item) => item !== undefined && item !== null)
                // tslint:disable-next-line:no-non-null-assertion
                .map((item) => item!)
                .reduce<PythonInterpreter[]>((prev, current) => {
                    if (prev.findIndex((item) => item.path.toUpperCase() === current.path.toUpperCase()) === -1) {
                        prev.push(current);
                    }
                    return prev;
                }, [])
        );
    }
    private async getCompanies(hive: RegistryHive, arch?: Architecture): Promise<CompanyInterpreter[]> {
        return this.registry.getKeys('\\Software\\Python', hive, arch).then((companyKeys) =>
            companyKeys
                .filter(
                    (companyKey) => CompaniesToIgnore.indexOf(this.pathUtils.basename(companyKey).toUpperCase()) === -1
                )
                .map((companyKey) => {
                    return { companyKey, hive, arch };
                })
        );
    }
    private async getInterpretersForCompany(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const tagKeys = await this.registry.getKeys(companyKey, hive, arch);
        return Promise.all(
            tagKeys.map((tagKey) => this.getInreterpreterDetailsForCompany(tagKey, companyKey, hive, arch))
        );
    }
    private getInreterpreterDetailsForCompany(
        tagKey: string,
        companyKey: string,
        hive: RegistryHive,
        arch?: Architecture
    ): Promise<PythonInterpreter | undefined | null> {
        const key = `${tagKey}\\InstallPath`;
        type InterpreterInformation =
            | null
            | undefined
            | {
                  installPath: string;
                  executablePath?: string;
                  displayName?: string;
                  version?: string;
                  companyDisplayName?: string;
              };
        return this.registry
            .getValue(key, hive, arch)
            .then((installPath) => {
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
                ]).then(([installedPath, executablePath, version, companyDisplayName]) => {
                    companyDisplayName =
                        AnacondaCompanyNames.indexOf(companyDisplayName!) === -1
                            ? companyDisplayName
                            : AnacondaCompanyName;
                    // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
                    return {
                        installPath: installedPath,
                        executablePath,
                        version,
                        companyDisplayName
                    } as InterpreterInformation;
                });
            })
            .then(async (interpreterInfo?: InterpreterInformation) => {
                if (!interpreterInfo) {
                    return;
                }

                const executablePath =
                    interpreterInfo.executablePath && interpreterInfo.executablePath.length > 0
                        ? interpreterInfo.executablePath
                        : path.join(interpreterInfo.installPath, DefaultPythonExecutable);

                if (this.windowsStoreInterpreter.isHiddenInterpreter(executablePath)) {
                    return;
                }
                const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
                const details = await helper.getInterpreterInformation(executablePath);
                if (!details) {
                    return;
                }
                const version = interpreterInfo.version
                    ? this.pathUtils.basename(interpreterInfo.version)
                    : this.pathUtils.basename(tagKey);
                this._hasInterpreters.resolve(true);
                // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
                return {
                    ...(details as PythonInterpreter),
                    path: executablePath,
                    // Do not use version info from registry, this doesn't contain the release level.
                    // Give preference to what we have retrieved from getInterpreterInformation.
                    version: details.version || parsePythonVersion(version),
                    companyDisplayName: interpreterInfo.companyDisplayName,
                    type: this.windowsStoreInterpreter.isWindowsStoreInterpreter(executablePath)
                        ? InterpreterType.WindowsStore
                        : InterpreterType.Unknown
                } as PythonInterpreter;
            })
            .then((interpreter) =>
                interpreter
                    ? this.fs
                          .fileExists(interpreter.path)
                          .catch(() => false)
                          .then((exists) => (exists ? interpreter : null))
                    : null
            )
            .catch((error) => {
                traceError(
                    `Failed to retrieve interpreter details for company ${companyKey},tag: ${tagKey}, hive: ${hive}, arch: ${arch}`,
                    error
                );
                return null;
            });
    }
    private async getCompanyDisplayName(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const displayName = await this.registry.getValue(companyKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
        const company = this.pathUtils.basename(companyKey);
        return company.toUpperCase() === PythonCoreComany ? PythonCoreCompanyDisplayName : company;
    }
}
