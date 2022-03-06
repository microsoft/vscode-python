import * as vscode from 'vscode';
import {
    Flake8CategorySeverity,
    ILintingSettings,
    IMypyCategorySeverity,
    IPycodestyleCategorySeverity,
    IPylintCategorySeverity,
} from '../client/common/types';

export class MockOutputChannel implements vscode.OutputChannel {
    public name: string;
    public output: string;
    public isShown!: boolean;
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    public append(value: string) {
        this.output += value;
    }
    public appendLine(value: string) {
        this.append(value);
        this.append('\n');
    }

    public replace(value: string): void {
        this.output = value;
    }

    public clear() {}
    public show(preservceFocus?: boolean): void;
    public show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;

    public show(_x?: any, _y?: any): void {
        this.isShown = true;
    }
    public hide() {
        this.isShown = false;
    }

    public dispose() {}
}

export class MockStatusBarItem implements vscode.StatusBarItem {
    backgroundColor: vscode.ThemeColor | undefined;
    accessibilityInformation: vscode.AccessibilityInformation | undefined;
    public alignment!: vscode.StatusBarAlignment;
    public priority!: number;
    public text!: string;
    public tooltip!: string;
    public color!: string;
    public command!: string;
    public id: string = '';
    public name: string = '';

    public show(): void {}

    public hide(): void {}

    public dispose(): void {}
}

export class MockLintingSettings implements ILintingSettings {
    public enabled!: boolean;
    public cwd?: string;
    public ignorePatterns!: string[];
    public prospectorEnabled!: boolean;
    public prospectorArgs!: string[];
    public pylintEnabled!: boolean;
    public pylintArgs!: string[];
    public pycodestyleEnabled!: boolean;
    public pycodestyleArgs!: string[];
    public pylamaEnabled!: boolean;
    public pylamaArgs!: string[];
    public flake8Enabled!: boolean;
    public flake8Args!: string[];
    public pydocstyleEnabled!: boolean;
    public pydocstyleArgs!: string[];
    public lintOnSave!: boolean;
    public maxNumberOfProblems!: number;
    public pylintCategorySeverity!: IPylintCategorySeverity;
    public pycodestyleCategorySeverity!: IPycodestyleCategorySeverity;
    public flake8CategorySeverity!: Flake8CategorySeverity;
    public mypyCategorySeverity!: IMypyCategorySeverity;
    public prospectorPath!: string;
    public pylintPath!: string;
    public pycodestylePath!: string;
    public pylamaPath!: string;
    public flake8Path!: string;
    public pydocstylePath!: string;
    public mypyEnabled!: boolean;
    public mypyArgs!: string[];
    public mypyPath!: string;
    public banditEnabled!: boolean;
    public banditArgs!: string[];
    public banditPath!: string;
}
