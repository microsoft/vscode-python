import { Uri } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IEnvironmentVariablesProvider } from '../variables/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService, IPythonExecutionFactory, IPythonExecutionService } from './types';

export class PythonExecutionFactory implements IPythonExecutionFactory {
    constructor(private procService: IProcessService, private envVarsService: IEnvironmentVariablesProvider) { }
    public async create(resource?: Uri): Promise<IPythonExecutionService> {
        const settings = PythonSettings.getInstance(resource);
        return this.envVarsService.getEnvironmentVariables(resource)
            .then(customEnvVars => {
                return new PythonExecutionService(this.procService, settings.pythonPath, customEnvVars);
            });
    }
}
