// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as WebSocketWS from 'ws';
import { ClassType } from '../ioc/types';
import { IKernelSocket } from './types';

// tslint:disable: no-any prefer-method-signature
export type IWebSocketLike = {
    onopen: (event: { target: any }) => void;
    onerror: (event: { error: any; message: string; type: string; target: any }) => void;
    onclose: (event: { wasClean: boolean; code: number; reason: string; target: any }) => void;
    onmessage: (event: { data: WebSocketWS.Data; type: string; target: any }) => void;
    emit(event: string | symbol, ...args: any[]): boolean;
    send(data: any, a2: any): void;
    close(): void;
};

/**
 * This is called a mixin class in TypeScript.
 * Allows us to have different base classes but inherit behavior (workaround for not allowing multiple inheritance).
 * Essentially it sticks a temp class in between the base class and the class you're writing.
 * Something like this:
 *
 * class Base {
 *    doStuff() {
 *
 *    }
 * }
 *
 * function Mixin = (SuperClass) {
 *   return class extends SuperClass {
 *      doExtraStuff() {
 *          super.doStuff();
 *      }
 *   }
 * }
 *
 * function SubClass extends Mixin(Base) {
 *    doBar() : {
 *        super.doExtraStuff();
 *    }
 * }
 *
 */

export function KernelSocketWrapper<T extends ClassType<IWebSocketLike>>(SuperClass: T) {
    return class BaseKernelSocket extends SuperClass implements IKernelSocket {
        private receiveHooks: ((data: WebSocketWS.Data) => Promise<void>)[];
        private sendHooks: ((data: any, cb?: (err?: Error) => void) => Promise<void>)[];
        private msgChain: Promise<any>;
        private sendChain: Promise<any>;

        constructor(...rest: any[]) {
            super(...rest);
            // Make sure the message chain is initialized
            this.msgChain = Promise.resolve();
            this.sendChain = Promise.resolve();
            this.receiveHooks = [];
            this.sendHooks = [];
        }

        public sendToRealKernel(data: any, a2: any) {
            // This will skip the send hooks. It's coming from
            // the UI side.
            super.send(data, a2);
        }

        public send(data: any, a2: any): void {
            if (this.sendHooks) {
                // Stick the send hooks into the send chain. We use chain
                // to ensure that:
                // a) Hooks finish before we fire the event for real
                // b) Event fires
                // c) Next message happens after this one (so the UI can handle the message before another event goes through)
                this.sendChain = this.sendChain
                    .then(() => Promise.all(this.sendHooks.map((s) => s(data, a2))))
                    .then(() => super.send(data, a2));
            } else {
                super.send(data, a2);
            }
        }

        public emit(event: string | symbol, ...args: any[]): boolean {
            if (event === 'message' && this.receiveHooks.length) {
                // Stick the receive hooks into the message chain. We use chain
                // to ensure that:
                // a) Hooks finish before we fire the event for real
                // b) Event fires
                // c) Next message happens after this one (so this side can handle the message before another event goes through)
                this.msgChain = this.msgChain
                    .then(() => Promise.all(this.receiveHooks.map((p) => p(args[0]))))
                    .then(() => super.emit(event, ...args));
                // True value indicates there were handlers. We definitely have 'message' handlers.
                return true;
            } else {
                return super.emit(event, ...args);
            }
        }

        public addReceiveHook(hook: (data: WebSocketWS.Data) => Promise<void>) {
            this.receiveHooks.push(hook);
        }
        public removeReceiveHook(hook: (data: WebSocketWS.Data) => Promise<void>) {
            this.receiveHooks = this.receiveHooks.filter((l) => l !== hook);
        }

        // tslint:disable-next-line: no-any
        public addSendHook(patch: (data: any, cb?: (err?: Error) => void) => Promise<void>): void {
            this.sendHooks.push(patch);
        }

        // tslint:disable-next-line: no-any
        public removeSendHook(patch: (data: any, cb?: (err?: Error) => void) => Promise<void>): void {
            this.sendHooks = this.sendHooks.filter((p) => p !== patch);
        }
    };
}
