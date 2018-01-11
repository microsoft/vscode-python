import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { ILintingSettings, PythonSettings } from '../common/configSettings';
import { ExecutionInfo, Product } from '../common/types';
import { ILinterCollection, LinterId, LinterSettingsPropertyNames, ILinter } from './types';

@injectable()
export class LinterManager implements ILinterManager {
    private linterIdMapping: Map<Product, LinterId>;
    constructor() {
        LinterCollection.initialize();
    }

    public getLinters(): ILinter[] {

    }
    

    private static initialize(): void {
        if (!LinterInfo.linterIdMapping) {
            LinterInfo.linterIdMapping = new Map<Product, LinterId>();

            this.linterIdMapping.set(Product.flake8, 'flake8');
            this.linterIdMapping.set(Product.mypy, 'mypy');
            this.linterIdMapping.set(Product.pep8, 'pep8');
            this.linterIdMapping.set(Product.prospector, 'prospector');
            this.linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
            this.linterIdMapping.set(Product.pylama, 'pylama');
            this.linterIdMapping.set(Product.pylint, 'pylint');
        }
    }
}
