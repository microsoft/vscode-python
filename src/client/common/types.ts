
export type EnvironmentVariables = Object & {
    [key: string]: string;
};

export interface IEnvironmentVariablesService {
    parseFile(filePath: string): Promise<EnvironmentVariables | undefined>;
    mergeVariables(source: EnvironmentVariables, target: EnvironmentVariables): void;
    prependPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]): void;
    appendPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]): void;
    prependPath(vars: EnvironmentVariables, ...paths: string[]): void;
    appendPath(vars: EnvironmentVariables, append: boolean, ...paths: string[]): void;
}
