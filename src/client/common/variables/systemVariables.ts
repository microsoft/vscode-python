import * as Path from 'path';
import * as Types from './sysTypes';
import { IStringDictionary, ISystemVariables } from './types';
/* tslint:disable:rule1 no-any no-unnecessary-callback-wrapper jsdoc-format no-for-in prefer-const no-increment-decrement */

export abstract class AbstractSystemVariables implements ISystemVariables {

    public resolve(value: string): string;
    public resolve(value: string[]): string[];
    public resolve(value: IStringDictionary<string>): IStringDictionary<string>;
    public resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
    public resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
    // tslint:disable-next-line:no-any
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

    public resolveAny<T>(value: T): T;
    // tslint:disable-next-line:no-any
    public resolveAny(value: any): any {
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
        const regexp = /\$\{(.*?)\}/g;
        return value.replace(regexp, (match: string, name: string) => {
            // tslint:disable-next-line:no-any
            const newValue = (<any>this)[name];
            if (Types.isString(newValue)) {
                return newValue;
            } else {
                return match && (match.indexOf('env.') > 0 || match.indexOf('env:') > 0) ? '' : match;
            }
        });
    }

    private __resolveLiteral(values: IStringDictionary<string | IStringDictionary<string> | string[]>): IStringDictionary<string | IStringDictionary<string> | string[]> {
        const result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
        Object.keys(values).forEach(key => {
            const value = values[key];
            // tslint:disable-next-line:no-any
            result[key] = <any>this.resolve(<any>value);
        });
        return result;
    }

    private __resolveAnyLiteral<T>(values: T): T;
    // tslint:disable-next-line:no-any
    private __resolveAnyLiteral(values: any): any {
        const result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
        Object.keys(values).forEach(key => {
            const value = values[key];
            // tslint:disable-next-line:no-any
            result[key] = <any>this.resolveAny(<any>value);
        });
        return result;
    }

    private __resolveArray(value: string[]): string[] {
        return value.map(s => this.__resolveString(s));
    }

    private __resolveAnyArray<T>(value: T[]): T[];
    // tslint:disable-next-line:no-any
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
            (this as any as { [key: string]: string })[`env:${key}`] = (this as any as { [key: string]: string })[`env.${key}`] = process.env[key];
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
