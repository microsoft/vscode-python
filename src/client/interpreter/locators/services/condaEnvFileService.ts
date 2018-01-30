import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { ILogger } from '../../../common/types';
import {
    ICondaService,
    IInterpreterLocatorService,
    IInterpreterVersionService,
    InterpreterType,
    PythonInterpreter
} from '../../contracts';
import { AnacondaCompanyName, AnacondaCompanyNames, AnacondaDisplayName } from './conda';

@injectable()
export class CondaEnvFileService implements IInterpreterLocatorService {
    constructor( @inject(IInterpreterVersionService) private versionService: IInterpreterVersionService,
        @inject(ICondaService) private condaService: ICondaService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(ILogger) private logger: ILogger) {
    }
    public async getInterpreters(_?: Uri) {
        return this.getSuggestionsFromConda();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        if (!this.condaService.condaEnvironmentsFile) {
            return [];
        }
        return this.fileSystem.fileExistsAsync(this.condaService.condaEnvironmentsFile!)
            .then(exists => exists ? this.getEnvironmentsFromFile(this.condaService.condaEnvironmentsFile!) : Promise.resolve([]));
    }
    private async getEnvironmentsFromFile(envFile: string) {
        try {
            const fileContents = await this.fileSystem.readFile(envFile);
            const environmentPaths = fileContents.split(/\r?\n/g)
                .map(environmentPath => environmentPath.trim())
                .filter(environmentPath => environmentPath.length > 0);

            const interpreters = (await Promise.all(environmentPaths
                .map(environmentPath => this.getInterpreterDetails(environmentPath))))
                .filter(item => !!item)
                .map(item => item!);

            const environments = await this.condaService.getCondaEnvironments();
            if (Array.isArray(environments) && environments.length > 0) {
                interpreters
                    .forEach(interpreter => {
                        const environment = environments.find(item => this.fileSystem.arePathsSame(item.path, interpreter!.envPath!));
                        if (environment) {
                            interpreter.envName = environment!.name;
                            interpreter.displayName = `${interpreter.displayName} (${environment!.name})`;
                        }
                    });
            }
            return interpreters;
        } catch (err) {
            this.logger.logError('Python Extension (getEnvironmentsFromFile.readFile):', err);
            // Ignore errors in reading the file.
            return [] as PythonInterpreter[];
        }
    }
    private async getInterpreterDetails(environmentPath: string): Promise<PythonInterpreter | undefined> {
        const interpreter = this.condaService.getInterpreterPath(environmentPath);
        if (!interpreter || !await this.fileSystem.fileExistsAsync(interpreter)) {
            return;
        }

        const version = await this.versionService.getVersion(interpreter, path.basename(interpreter));
        const versionWithoutCompanyName = this.stripCompanyName(version);
        return {
            displayName: `${AnacondaDisplayName} ${versionWithoutCompanyName}`,
            path: interpreter,
            companyDisplayName: AnacondaCompanyName,
            version: version,
            type: InterpreterType.Conda,
            envPath: environmentPath
        };
    }
    private stripCompanyName(content: string) {
        // Strip company name from version.
        const startOfCompanyName = AnacondaCompanyNames.reduce((index, companyName) => {
            if (index > 0) {
                return index;
            }
            return content.indexOf(`:: ${companyName}`);
        }, -1);

        return startOfCompanyName > 0 ? content.substring(0, startOfCompanyName).trim() : content;
    }
}
