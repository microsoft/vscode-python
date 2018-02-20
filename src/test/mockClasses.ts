import * as vscode from 'vscode';
import {
    Flake8CategorySeverity, ILintingSettings, IMypyCategorySeverity,
    IPep8CategorySeverity, IPylintCategorySeverity
} from '../client/common/types';

export class MockOutputChannel implements vscode.OutputChannel {
    public name: string;
    public output: string;
    public isShown: boolean;
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    public append(value: string) {
        this.output += value;
    }
    public appendLine(value: string) { this.append(value); this.append('\n'); }
    // tslint:disable-next-line:no-empty
    public clear() { }
    public show(preservceFocus?: boolean): void;
    public show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    // tslint:disable-next-line:no-any
    public show(x?: any, y?: any): void {
        this.isShown = true;
    }
    public hide() {
        this.isShown = false;
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
}

export class MockStatusBarItem implements vscode.StatusBarItem {
    public alignment: vscode.StatusBarAlignment;
    public priority: number;
    public text: string;
    public tooltip: string;
    public color: string;
    public command: string;
    // tslint:disable-next-line:no-empty
    public show(): void {
    }
    // tslint:disable-next-line:no-empty
    public hide(): void {
    }
    // tslint:disable-next-line:no-empty
    public dispose(): void {
    }
}

export class MockLintingSettings implements ILintingSettings {
    public enabled: boolean;
    public ignorePatterns: string[];
    public prospectorEnabled: boolean;
    public prospectorArgs: string[];
    public pylintEnabled: boolean;
    public pylintArgs: string[];
    public pep8Enabled: boolean;
    public pep8Args: string[];
    public pylamaEnabled: boolean;
    public pylamaArgs: string[];
    public flake8Enabled: boolean;
    public flake8Args: string[];
    public pydocstyleEnabled: boolean;
    public pydocstyleArgs: string[];
    public lintOnSave: boolean;
    public maxNumberOfProblems: number;
    public pylintCategorySeverity: IPylintCategorySeverity;
    public pep8CategorySeverity: IPep8CategorySeverity;
    public flake8CategorySeverity: Flake8CategorySeverity;
    public mypyCategorySeverity: IMypyCategorySeverity;
    public prospectorPath: string;
    public pylintPath: string;
    public pep8Path: string;
    public pylamaPath: string;
    public flake8Path: string;
    public pydocstylePath: string;
    public mypyEnabled: boolean;
    public mypyArgs: string[];
    public mypyPath: string;
    public pylintUseMinimalCheckers: boolean;
}
