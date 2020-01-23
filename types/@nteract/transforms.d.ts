declare module '@nteract/transforms' {
    export class GIFTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
    }
    export class HTMLTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        componentDidMount(): void;
        componentDidUpdate(): void;
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export class JPEGTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
    }
    export class JSONTransform {
        static MIMETYPE: string;
        static defaultProps: {
            data: {};
            metadata: {};
            theme: string;
        };
        static handles(mimetype: any): any;
        constructor(props: any);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
        shouldExpandNode(): any;
    }
    export class JavaScriptTransform {
        static MIMETYPE: string;
        static handles(mimetype: any): any;
        constructor(...args: any[]);
        componentDidMount(): void;
        componentDidUpdate(): void;
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export function LaTeXTransform(props: any, context: any): any;
    export namespace LaTeXTransform {
        const MIMETYPE: string;
        namespace contextTypes {
            function MathJax(p0: any, p1: any, p2: any, p3: any, p4: any, p5: any): any;
            namespace MathJax {
                function isRequired(p0: any, p1: any, p2: any, p3: any, p4: any, p5: any): any;
            }
            function MathJaxContext(p0: any, p1: any, p2: any, p3: any, p4: any, p5: any): any;
            namespace MathJaxContext {
                function isRequired(p0: any, p1: any, p2: any, p3: any, p4: any, p5: any): any;
            }
        }
    }
    export class MarkdownTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export class PNGTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
    }
    export class SVGTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        componentDidMount(): void;
        componentDidUpdate(): void;
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export class TextTransform {
        static MIMETYPE: string;
        constructor(...args: any[]);
        forceUpdate(callback: any): void;
        render(): any;
        setState(partialState: any, callback: any): void;
        shouldComponentUpdate(nextProps: any): any;
    }
    export const displayOrder: string[];
    export function registerTransform(_ref: any, transform: any): any;
    export function richestMimetype(bundle: any, ...args: any[]): any;
    export const standardDisplayOrder: string[];

    export let standardTransforms: {};
    export namespace transforms {}
}
