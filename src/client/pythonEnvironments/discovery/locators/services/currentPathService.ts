/* eslint-disable max-classes-per-file */
// tslint:disable:no-require-imports no-var-requires underscore-consistent-invocation no-unnecessary-callback-wrapper
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { traceError, traceInfo } from '../../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import * as internalPython from '../../../../common/process/internal/python';
import { IProcessServiceFactory } from '../../../../common/process/types';
import { IConfigurationService } from '../../../../common/types';
import { OSType } from '../../../../common/utils/platform';
import { IInterpreterHelper } from '../../../../interpreter/contracts';
import { IPythonInPathCommandProvider } from '../../../../interpreter/locators/types';
import { IServiceContainer } from '../../../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../info';
import { CacheableLocatorService } from './cacheableLocatorService';

/**
 * Locates the currently configured Python interpreter.
 *
 * If no interpreter is configured then it falls back to the system
 * Python (3 then 2).
 */
@injectable()
export class CurrentPathService extends CacheableLocatorService {
    private readonly fs: IFileSystem;

    public constructor(
        @inject(IInterpreterHelper) private helper: IInterpreterHelper,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IPythonInPathCommandProvider) private readonly pythonCommandProvider: IPythonInPathCommandProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
    ) {
        super('CurrentPathService', serviceContainer);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    public dispose(): void {
        // No body
    }

    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonEnvironment[]> {
        return this.suggestionsFromKnownPaths(resource);
    }

    /**
     * Return the located interpreters.
     */
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const configSettings = this.serviceContainer
            .get<IConfigurationService>(IConfigurationService)
            .getSettings(resource);
        const pathsToCheck = [...this.pythonCommandProvider.getCommands(), { command: configSettings.pythonPath }];

        const pythonPaths = Promise.all(pathsToCheck.map((item) => this.getInterpreter(item)));
        return (
            pythonPaths
                .then((interpreters) => interpreters.filter((item) => item.length > 0))
                // tslint:disable-next-line:promise-function-async
                .then((interpreters) => Promise.all(
                    interpreters.map((interpreter) => this.getInterpreterDetails(interpreter)),
                ))
                .then((interpreters) => interpreters.filter((item) => !!item).map((item) => item!))
        );
    }

    /**
     * Return the information about the identified interpreter binary.
     */
    private async getInterpreterDetails(pythonPath: string): Promise<PythonEnvironment | undefined> {
        return this.helper.getInterpreterInformation(pythonPath).then((details) => {
            if (!details) {
                return undefined;
            }
            this._hasInterpreters.resolve(true);
            return {
                ...(details as PythonEnvironment),
                path: pythonPath,
                envType: details.envType ? details.envType : EnvironmentType.Unknown,
            };
        });
    }

    /**
     * Return the path to the interpreter (or the default if not found).
     */
    private async getInterpreter(options: { command: string; args?: string[] }) {
        try {
            const processService = await this.processServiceFactory.create();
            const pyArgs = Array.isArray(options.args) ? options.args : [];
            const [args, parse] = internalPython.getExecutable();
            return processService
                .exec(options.command, pyArgs.concat(args), {})
                .then((output) => parse(output.stdout))
                .then(async (value) => {
                    if (value.length > 0 && (await this.fs.fileExists(value))) {
                        return value;
                    }
                    traceError(
                        `Detection of Python Interpreter for Command ${options.command} and args ${pyArgs.join(
                            ' ',
                        )} failed as file ${value} does not exist`,
                    );
                    return '';
                })
                .catch(() => {
                    traceInfo(
                        `Detection of Python Interpreter for Command ${options.command} and args ${pyArgs.join(
                            ' ',
                        )} failed`,
                    );
                    return '';
                }); // Ignore exceptions in getting the executable.
        } catch (ex) {
            traceError(`Detection of Python Interpreter for Command ${options.command} failed`, ex);
            return ''; // Ignore exceptions in getting the executable.
        }
    }
}

@injectable()
export class PythonInPathCommandProvider implements IPythonInPathCommandProvider {
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService) {}

    public getCommands(): { command: string; args?: string[] }[] {
        const paths = ['python3.7', 'python3.6', 'python3', 'python2', 'python'].map((item) => ({ command: item }));
        if (this.platform.osType !== OSType.Windows) {
            return paths;
        }

        const versions = ['3.7', '3.6', '3', '2'];
        return paths.concat(
            versions.map((version) => ({ command: 'py', args: [`-${version}`] })),
        );
    }
}
