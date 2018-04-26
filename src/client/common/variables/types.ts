// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from 'vscode';

export type EnvironmentVariables = Object & {
    [key: string]: string;
};

export const IEnvironmentVariablesService = Symbol('IEnvironmentVariablesService');

export interface IEnvironmentVariablesService {
    parseFile(filePath: string): Promise<EnvironmentVariables | undefined>;
    mergeVariables(source: EnvironmentVariables, target: EnvironmentVariables): void;
    appendPythonPath(vars: EnvironmentVariables, ...pythonPaths: string[]): void;
    appendPath(vars: EnvironmentVariables, ...paths: string[]): void;
}

/**
 * An interface for a JavaScript object that
 * acts as a dictionary. The keys are strings.
 */
export interface IStringDictionary<V> {
    [name: string]: V;
}

export interface ISystemVariables {
    resolve(value: string): string;
    resolve(value: string[]): string[];
    resolve(value: IStringDictionary<string>): IStringDictionary<string>;
    resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
    resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
    resolveAny<T>(value: T): T;
    // tslint:disable-next-line:no-any
    [key: string]: any;
}

export const IEnvironmentVariablesProvider = Symbol('IEnvironmentVariablesProvider');

export interface IEnvironmentVariablesProvider {
    onDidEnvironmentVariablesChange: Event<Uri | undefined>;
    getEnvironmentVariables(resource?: Uri): Promise<EnvironmentVariables>;
}
