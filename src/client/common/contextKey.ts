import { commands } from 'vscode';

export class ContextKey {
    private lastValue: boolean;

    constructor(private name: string) { }

    public async set(value: boolean): Promise<void> {
        if (this.lastValue === value) {
            return;
        }
        this.lastValue = value;
        await commands.executeCommand('setContext', this.name, this.lastValue);
    }
}
