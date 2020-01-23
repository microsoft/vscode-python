declare module '@nteract/transform-vdom' {
    export class VDOM {
        static MIMETYPE: string;
        constructor(...args: any[]);
        componentDidMount(): void;
        componentDidUpdate(): void;
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
}
