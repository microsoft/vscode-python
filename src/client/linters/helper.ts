import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { ILintingSettings, PythonSettings } from '../common/configSettings';
import { ExecutionInfo, Product } from '../common/types';
import { ILinterHelper, LinterId, LinterSettingsPropertyNames } from './types';

@injectable()
export class LinterHelper implements ILinterHelper {
    private linterIdMapping: Map<Product, LinterId>;
    constructor() {
        this.linterIdMapping = new Map<Product, LinterId>();

        this.linterIdMapping.set(Product.flake8, 'flake8');
        this.linterIdMapping.set(Product.mypy, 'mypy');
        this.linterIdMapping.set(Product.pep8, 'pep8');
        this.linterIdMapping.set(Product.prospector, 'prospector');
        this.linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
        this.linterIdMapping.set(Product.pylama, 'pylama');
        this.linterIdMapping.set(Product.pylint, 'pylint');
    }
    public getExecutionInfo(linter: Product, customArgs: string[], resource?: Uri): ExecutionInfo {
        const settings = PythonSettings.getInstance(resource);
        const names = this.getSettingsPropertyNames(linter);

        const execPath = settings.linting[names.pathName] as string;
        let args: string[] = Array.isArray(settings.linting[names.argsName]) ? settings.linting[names.argsName] as string[] : [];
        args = args.concat(customArgs);

        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        // Except for prospector as that needs to be run as an executable (its a python package).
        if (path.basename(execPath) === execPath && linter !== Product.prospector) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: linter };
    }
    public translateToId(linter: Product): LinterId {
        if (this.linterIdMapping.has(linter)) {
            return this.linterIdMapping.get(linter)!;
        }
        throw new Error('Invalid linter');
    }
    public getSettingsPropertyNames(linter: Product): LinterSettingsPropertyNames {
        const id = this.translateToId(linter);
        return {
            argsName: `${id}Args` as keyof ILintingSettings,
            pathName: `${id}Path` as keyof ILintingSettings,
            enabledName: `${id}Enabled` as keyof ILintingSettings
        };
    }
}
