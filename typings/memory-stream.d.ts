declare module 'memory-streams' {
    export class ReadableStream implements NodeJS.ReadableStream {
        readable: boolean;
        read(size?: number): string | Buffer;
        setEncoding(encoding: string): void;
        pause(): this;
        resume(): this;
        isPaused(): boolean;
        pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
        unpipe<T extends NodeJS.WritableStream>(destination?: T): void;
        unshift(chunk: string): void;
        unshift(chunk: Buffer): void;
        unshift(chunk: any);
        wrap(oldStream: NodeJS.ReadableStream): NodeJS.ReadableStream;
        addListener(event: string | symbol, listener: Function): this;
        on(event: string | symbol, listener: Function): this;
        once(event: string | symbol, listener: Function): this;
        removeListener(event: string | symbol, listener: Function): this;
        removeAllListeners(event?: string | symbol): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: string | symbol): Function[];
        emit(event: string | symbol, ...args: any[]): boolean;
        listenerCount(type: string | symbol): number;
        prependListener(event: string | symbol, listener: Function): this;
        prependOnceListener(event: string | symbol, listener: Function): this;
        eventNames(): (string | symbol)[];
        constructor(content: string);
    }
}
