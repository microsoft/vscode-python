import * as Types from './types';
import * as vscode from 'vscode';
import * as Path from 'path';

/**
 * An interface for a JavaScript object that
 * acts a dictionary. The keys are strings.
 */
export interface IStringDictionary<V> {
    [name: string]: V;
}

export abstract class Parser {
    protected log(message: string): void {
    }

    protected is(value: any, func: (value: any) => boolean, wrongTypeState?: any, wrongTypeMessage?: string, undefinedState?: any, undefinedMessage?: string): boolean {
        if (Types.isUndefined(value)) {
            return false;
        }
        if (!func(value)) {
            return false;
        }
        return true;
    }

    protected static merge<T>(destination: T, source: T, overwrite: boolean): void {
        Object.keys(source).forEach((key) => {
            let destValue = destination[key];
            let sourceValue = source[key];
            if (Types.isUndefined(sourceValue)) {
                return;
            }
            if (Types.isUndefined(destValue)) {
                destination[key] = sourceValue;
            } else {
                if (overwrite) {
                    if (Types.isObject(destValue) && Types.isObject(sourceValue)) {
                        this.merge(destValue, sourceValue, overwrite);
                    } else {
                        destination[key] = sourceValue;
                    }
                }
            }
        });
    }
}


export interface ISystemVariables {
    resolve(value: string): string;
    resolve(value: string[]): string[];
    resolve(value: IStringDictionary<string>): IStringDictionary<string>;
    resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
    resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
    resolveAny<T>(value: T): T;
    [key: string]: any;
}
export abstract class AbstractSystemVariables implements ISystemVariables {

    public resolve(value: string): string;
    public resolve(value: string[]): string[];
    public resolve(value: IStringDictionary<string>): IStringDictionary<string>;
    public resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
    public resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
    public resolve(value: any): any {
        if (Types.isString(value)) {
            return this.__resolveString(value);
        } else if (Types.isArray(value)) {
            return this.__resolveArray(value);
        } else if (Types.isObject(value)) {
            return this.__resolveLiteral(value);
        }

        return value;
    }

    resolveAny<T>(value: T): T;
    resolveAny<T>(value: any): any {
        if (Types.isString(value)) {
            return this.__resolveString(value);
        } else if (Types.isArray(value)) {
            return this.__resolveAnyArray(value);
        } else if (Types.isObject(value)) {
            return this.__resolveAnyLiteral(value);
        }

        return value;
    }

    private __resolveString(value: string): string {
        let regexp = /\$\{(.*?)\}/g;
        return value.replace(regexp, (match: string, name: string) => {
            let newValue = (<any>this)[name];
            if (Types.isString(newValue)) {
                return newValue;
            } else {
                return match && (match.indexOf('env.') > 0 || match.indexOf('env:') > 0) ? '' : match;
            }
        });
    }

    private __resolveLiteral(values: IStringDictionary<string | IStringDictionary<string> | string[]>): IStringDictionary<string | IStringDictionary<string> | string[]> {
        let result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
        Object.keys(values).forEach(key => {
            let value = values[key];
            result[key] = <any>this.resolve(<any>value);
        });
        return result;
    }

    private __resolveAnyLiteral<T>(values: T): T;
    private __resolveAnyLiteral<T>(values: any): any {
        let result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
        Object.keys(values).forEach(key => {
            let value = values[key];
            result[key] = <any>this.resolveAny(<any>value);
        });
        return result;
    }

    private __resolveArray(value: string[]): string[] {
        return value.map(s => this.__resolveString(s));
    }

    private __resolveAnyArray<T>(value: T[]): T[];
    private __resolveAnyArray(value: any[]): any[] {
        return value.map(s => this.resolveAny(s));
    }
}


export class SystemVariables extends AbstractSystemVariables {
    private _workspaceFolder: string;
    private _workspaceFolderName: string;

    constructor(workspaceFolder?: string) {
        super();
        this._workspaceFolder = typeof workspaceFolder === 'string' ? workspaceFolder : __dirname;
        this._workspaceFolderName = Path.basename(this._workspaceFolder);
        Object.keys(process.env).forEach(key => {
            this[`env:${key}`] = this[`env.${key}`] = process.env[key];
        });
    }

    public get cwd(): string {
        return this.workspaceFolder;
    }

    public get workspaceRoot(): string {
        return this._workspaceFolder;
    }

    public get workspaceFolder(): string {
        return this._workspaceFolder;
    }

    public get workspaceRootFolderName(): string {
        return this._workspaceFolderName;
    }

    public get workspaceFolderBasename(): string {
        return this._workspaceFolderName;
    }
}
