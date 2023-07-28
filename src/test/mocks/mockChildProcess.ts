/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Serializable, SendHandle } from 'child_process';
import { Writable, Readable, Pipe } from 'stream';
import { EventEmitter, MessageOptions } from 'vscode';

export class MockChildProcess extends EventEmitter<T> {
    constructor(spawnfile: string, spawnargs: string[]) {
        super();
        this.spawnfile = spawnfile;
        this.spawnargs = spawnargs;
        this.stdin = null;
        this.stdout = null;
        this.stderr = null;
        this.channel = null;
        this.stdio = [null, this.stdin, this.stdout, this.stderr, null];
        this.killed = false;
        this.connected = false;
        this.exitCode = null;
        this.signalCode = null;
        this.listenerList = [];
    }

    stdin: Writable | null;

    stdout: Readable | null;

    stderr: Readable | null;

    listenerList: unknown[];

    readonly channel?: Pipe | null | undefined;

    readonly stdio: [
        Writable | null,
        // stdin
        Readable | null,
        // stdout
        Readable | null,
        // stderr
        Readable | Writable | null | undefined,
        // extra
        Readable | Writable | null | undefined, // extra
    ];

    readonly killed: boolean;

    readonly pid?: number | undefined;

    readonly connected: boolean;

    readonly exitCode: number | null;

    readonly signalCode: NodeJS.Signals | null;

    readonly spawnargs: string[];

    readonly spawnfile: string;

    signal?: NodeJS.Signals | number;

    send(message: Serializable, callback?: (error: Error | null) => void): boolean;

    send(message: Serializable, sendHandle?: SendHandle, callback?: (error: Error | null) => void): boolean;

    send(
        message: Serializable,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        sendHandle?: SendHandle,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options?: MessageOptions,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        callback?: (error: Error | null) => void,
    ): boolean {
        this.stdin = new Writable();
        this.stdin.write(message.toString());
        return true;
    }

    // eslint-disable-next-line class-methods-use-this
    disconnect(): void {
        /* noop */
    }

    // eslint-disable-next-line class-methods-use-this
    unref(): void {
        /* noop */
    }

    // eslint-disable-next-line class-methods-use-this
    ref(): void {
        /* noop */
    }

    addListener(event: string, listener: (...args: any[]) => void): this {
        return this;
    }

    addListener(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    addListener(event: 'disconnect', listener: () => void): this;

    addListener(event: 'error', listener: (err: Error) => void): this;

    addListener(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    addListener(event: 'message', listener: (message: Serializable, sendHandle: SendHandle) => void): this;

    addListener(event: 'spawn', listener: () => void): this;

    emit(event: string | symbol, ...args: unknown[]): boolean;

    emit(event: 'close', code: number | null, signal: NodeJS.Signals | null): boolean;

    emit(event: 'disconnect'): boolean;

    emit(event: 'error', err: Error): boolean;

    emit(event: 'exit', code: number | null, signal: NodeJS.Signals | null): boolean;

    emit(event: 'message', message: Serializable, sendHandle: SendHandle): boolean;

    emit(event: 'spawn', listener: () => void): boolean {
        /* noop */
        this.emit(event);
        return true;
    }

    on(event: string, listener: (...args: any[]) => void): this {
        this.listenerList.push({ event, listener });
        return this;
    }

    on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    on(event: 'disconnect', listener: () => void): this;

    on(event: 'error', listener: (err: Error) => void): this;

    on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    on(event: 'message', listener: (message: Serializable, sendHandle: SendHandle) => void): this;

    on(event: 'spawn', listener: () => void): this;

    once(event: string, listener: (...args: any[]) => void): this {
        this.listenerList.push({ event, listener });
        return this;
    }

    once(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    once(event: 'disconnect', listener: () => void): this;

    once(event: 'error', listener: (err: Error) => void): this;

    once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    once(event: 'message', listener: (message: Serializable, sendHandle: SendHandle) => void): this;

    once(event: 'spawn', listener: () => void): this;

    prependListener(event: string, listener: (...args: any[]) => void): this;

    prependListener(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    prependListener(event: 'disconnect', listener: () => void): this;

    prependListener(event: 'error', listener: (err: Error) => void): this;

    prependListener(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    prependListener(event: 'message', listener: (message: Serializable, sendHandle: SendHandle) => void): this;

    prependListener(event: 'spawn', listener: () => void): this;

    prependOnceListener(event: string, listener: (...args: any[]) => void): this;

    prependOnceListener(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    prependOnceListener(event: 'disconnect', listener: () => void): this;

    prependOnceListener(event: 'error', listener: (err: Error) => void): this;

    prependOnceListener(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    prependOnceListener(event: 'message', listener: (message: Serializable, sendHandle: SendHandle) => void): this;

    prependOnceListener(event: 'spawn', listener: () => void): this;
}
