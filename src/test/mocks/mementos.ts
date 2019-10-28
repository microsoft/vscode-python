import { injectable } from 'inversify';
import { Memento } from 'vscode';

@injectable()
export class MockMemento implements Memento {
    private map: Map<string, {}> = new Map<string, {}>();
    // @ts-ignore
    // tslint:disable-next-line:no-any
    public get(key: any, defaultValue?: any);
    public get<T>(key: string, defaultValue?: T): T {
        const exists = this.map.has(key);
        // tslint:disable-next-line:no-any
        return exists ? this.map.get(key) : defaultValue! as any;
    }
    // tslint:disable-next-line:no-any
    public update(key: string, value: any): Thenable<void> {
        this.map.set(key, value);
        return Promise.resolve();
    }
    public clear() {
        this.map.clear();
    }
}
