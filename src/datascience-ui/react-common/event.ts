// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable: no-any
export type Event<T> = (listener: (e?: T) => any) => void;

// Simpler version of the vscode event emitter for passing down through react components.
// Easier to manage than forwarding refs when not sure what the type of the ref should be.
//
// We can't use the vscode version because pulling in vscode apis is not allowed in a webview
export class EventEmitter<T> {
    private _event: Event<T> | undefined;
    private _listeners: Set<(e?: T) => any> = new Set<(e?: T) => any>();

    public get event(): Event<T> {
        if (!this._event) {
            this._event = (listener: (e?: T) => any): void => {
                this._listeners.add(listener);
            };
        }
        return this._event;
    }

    public fire(data?: T): void {
        this._listeners.forEach((c) => c(data));
    }

    public dispose(): void {
        this._listeners.clear();
    }
}

export interface IKeyboardEvent {
    readonly code: string;
    readonly target: HTMLElement;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
    readonly editorInfo?: {
        isFirstLine: boolean;
        isLastLine: boolean;
        isSuggesting: boolean;
        isDirty: boolean;
        contents: string;
        clear(): void;
    };
    preventDefault(): void;
    stopPropagation(): void;
}
