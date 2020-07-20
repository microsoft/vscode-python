interface Disposable {
    dispose(): void;
}

export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
}

declare global {
    export interface INotebookRendererApi<T> {
        setState(value: T): void;
        getState(): T | undefined;

        /**
         * Sends a message to the renderer extension code. Can be received in
         * the `onDidReceiveMessage` event in `NotebookCommunication`.
         */
        postMessage(msg: unknown): void;

        /**
         * Fired before an output is destroyed, with its output ID, or undefined if
         * all cells are about to unmount.
         */
        onWillDestroyOutput: Event<{ outputId: string } | undefined>;

        /**
         * Fired when an output is rendered. The `outputId` provided is the same
         * as the one given in {@see NotebookOutputRenderer.render}
         * and {@see onWillDestroyOutput}.
         */
        onDidCreateOutput: Event<{ element: HTMLElement; outputId: string }>;

        /**
         * Called when the renderer uses `postMessage` on the NotebookCommunication
         * instance for this renderer.
         */
        onDidReceiveMessage: Event<any>;
    }

    function acquireNotebookRendererApi<T = any>(rendererType: string): INotebookRendererApi<T>;
}
