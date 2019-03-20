declare module '@nteract/transform-plotly' {
    export function PlotlyNullTransform(): any;
    export namespace PlotlyNullTransform {
        const MIMETYPE: string;
    }
    export class PlotlyTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        componentDidMount(): void;
        componentDidUpdate(): void;
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export default class _default {
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
