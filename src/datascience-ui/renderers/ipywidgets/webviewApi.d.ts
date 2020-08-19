export interface IVsCodeApi {
    // tslint:disable-next-line:no-any
    postMessage(msg: any): void;
    // tslint:disable-next-line:no-any
    setState(state: any): void;
    // tslint:disable-next-line:no-any
    getState(): any;
}

declare global {
    function acquireVsCodeApi(): IVsCodeApi;
}
