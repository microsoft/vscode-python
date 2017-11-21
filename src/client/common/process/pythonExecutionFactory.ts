import { Uri } from 'vscode';
import { PythonSettings } from '../configSettings';
import { EnvironmentVariables, IEnvironmentVariablesService } from '../variables/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService, IPythonExecutionFactory, IPythonExecutionService } from './types';

export class PythonExecutionFactory implements IPythonExecutionFactory {
    private cachedVars = new Map<string, EnvironmentVariables | undefined>();
    constructor(private procService: IProcessService, private envVarsService: IEnvironmentVariablesService) { }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        const settings = PythonSettings.getInstance(resource);
        return this.getExecutionVariables(resource)
            .then(customEnvVars => {
                return new PythonExecutionService(settings.pythonPath, customEnvVars, this.procService);
            });
    }
    private async getExecutionVariables(resource?: Uri): Promise<EnvironmentVariables | undefined> {
        const pythonSettings = PythonSettings.getInstance(resource);
        if (this.cachedVars.has(pythonSettings.envFile)) {
            return this.cachedVars.get(pythonSettings.envFile);
        }
        const settings = PythonSettings.getInstance(resource);
        const envFile = settings.envFile;
        const vars = await this.envVarsService.parseFile(envFile);
        this.cachedVars.set(pythonSettings.envFile, vars);
        return vars;
    }
}
