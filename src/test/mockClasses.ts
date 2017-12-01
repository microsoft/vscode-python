import * as vscode from 'vscode';

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
