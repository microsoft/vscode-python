// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// Note: Don't change this to a tsx file as it loads in the unit tests. That will mess up mocha

// Custom module loader so we can skip loading the 'canvas' module which won't load
// inside of vscode
// tslint:disable:no-var-requires no-require-imports no-any no-function-expression
const Module = require('module');

(function () {
    const origRequire = Module.prototype.require;
    const _require = (context: any, filepath: any) => {
        return origRequire.call(context, filepath);
    };
    Module.prototype.require = function (filepath: string) {
        if (filepath === 'canvas') {
            try {
                // Make sure we aren't inside of vscode. The nodejs version of Canvas won't match. At least sometimes.
                if (require('vscode')) {
                    return '';
                }
            } catch {
                // This should happen when not inside vscode.
            }
        }
        // tslint:disable-next-line:no-invalid-this
        return _require(this, filepath);
    };
})();

// tslint:disable:no-string-literal no-any object-literal-key-quotes max-func-body-length member-ordering
// tslint:disable: no-require-imports no-var-requires

// Monkey patch the stylesheet impl from jsdom before loading jsdom.
// This is necessary to get slickgrid to work.
const utils = require('jsdom/lib/jsdom/living/generated/utils');
const ssExports = require('jsdom/lib/jsdom/living/helpers/stylesheets');
if (ssExports && ssExports.createStylesheet) {
    const orig = ssExports.createStylesheet;
    ssExports.createStylesheet = (sheetText: any, elementImpl: any, baseURL: any) => {
        // Call the original.
        orig(sheetText, elementImpl, baseURL);

        // Then pull out the style sheet and add some properties. See the discussion here
        // https://github.com/jsdom/jsdom/issues/992
        if (elementImpl.sheet) {
            elementImpl.sheet.href = baseURL;
            elementImpl.sheet.ownerNode = utils.wrapperForImpl(elementImpl);
        }
    };
}

import { ComponentClass, configure, ReactWrapper } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { DOMWindow, JSDOM } from 'jsdom';
import * as React from 'react';

import { noop } from '../../client/common/utils/misc';

class MockCanvas implements CanvasRenderingContext2D {
    public canvas!: HTMLCanvasElement;
    public restore(): void {
        throw new Error('Method not implemented.');
    }
    public save(): void {
        throw new Error('Method not implemented.');
    }
    public getTransform(): DOMMatrix {
        throw new Error('Method not implemented.');
    }
    public resetTransform(): void {
        throw new Error('Method not implemented.');
    }
    public rotate(_angle: number): void {
        throw new Error('Method not implemented.');
    }
    public scale(_x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    public setTransform(transform?: DOMMatrix2DInit | undefined): void;
    public setTransform(_a?: any, _b?: any, _c?: any, _d?: any, _e?: any, _f?: any) {
        throw new Error('Method not implemented.');
    }
    public transform(_a: number, _b: number, _c: number, _d: number, _e: number, _f: number): void {
        throw new Error('Method not implemented.');
    }
    public translate(_x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public globalAlpha!: number;
    public globalCompositeOperation!: string;
    public imageSmoothingEnabled!: boolean;
    public imageSmoothingQuality!: ImageSmoothingQuality;
    public fillStyle!: string | CanvasGradient | CanvasPattern;
    public strokeStyle!: string | CanvasGradient | CanvasPattern;
    public createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number): CanvasGradient {
        throw new Error('Method not implemented.');
    }
    public createPattern(_image: CanvasImageSource, _repetition: string): CanvasPattern | null {
        throw new Error('Method not implemented.');
    }
    public createRadialGradient(
        _x0: number,
        _y0: number,
        _r0: number,
        _x1: number,
        _y1: number,
        _r1: number
    ): CanvasGradient {
        throw new Error('Method not implemented.');
    }
    public shadowBlur!: number;
    public shadowColor!: string;
    public shadowOffsetX!: number;
    public shadowOffsetY!: number;
    public filter!: string;
    public clearRect(_x: number, _y: number, _w: number, _h: number): void {
        throw new Error('Method not implemented.');
    }
    public fillRect(_x: number, _y: number, _w: number, _h: number): void {
        throw new Error('Method not implemented.');
    }
    public strokeRect(_x: number, _y: number, _w: number, _h: number): void {
        throw new Error('Method not implemented.');
    }
    public beginPath(): void {
        throw new Error('Method not implemented.');
    }
    public clip(fillRule?: 'nonzero' | 'evenodd' | undefined): void;
    public clip(path: Path2D, fillRule?: 'nonzero' | 'evenodd' | undefined): void;
    public clip(_path?: any, _fillRule?: any) {
        throw new Error('Method not implemented.');
    }
    public fill(fillRule?: 'nonzero' | 'evenodd' | undefined): void;
    public fill(path: Path2D, fillRule?: 'nonzero' | 'evenodd' | undefined): void;
    public fill(_path?: any, _fillRule?: any) {
        throw new Error('Method not implemented.');
    }
    public isPointInPath(x: number, y: number, fillRule?: 'nonzero' | 'evenodd' | undefined): boolean;
    public isPointInPath(path: Path2D, x: number, y: number, fillRule?: 'nonzero' | 'evenodd' | undefined): boolean;
    public isPointInPath(_path: any, _x: any, _y?: any, _fillRule?: any): boolean {
        throw new Error('Method not implemented.');
    }
    public isPointInStroke(x: number, y: number): boolean;
    public isPointInStroke(path: Path2D, x: number, y: number): boolean;
    public isPointInStroke(_path: any, _x: any, _y?: any): boolean {
        throw new Error('Method not implemented.');
    }
    public stroke(): void;
    // tslint:disable-next-line: unified-signatures
    public stroke(path: Path2D): void;
    public stroke(_path?: any) {
        throw new Error('Method not implemented.');
    }
    public drawFocusIfNeeded(element: Element): void;
    public drawFocusIfNeeded(path: Path2D, element: Element): void;
    public drawFocusIfNeeded(_path: any, _element?: any) {
        throw new Error('Method not implemented.');
    }
    public scrollPathIntoView(): void;
    // tslint:disable-next-line: unified-signatures
    public scrollPathIntoView(path: Path2D): void;
    public scrollPathIntoView(_path?: any) {
        throw new Error('Method not implemented.');
    }
    public fillText(_text: string, _x: number, _y: number, _maxWidth?: number | undefined): void {
        throw new Error('Method not implemented.');
    }
    public measureText(_text: string): TextMetrics {
        throw new Error('Method not implemented.');
    }
    public strokeText(_text: string, _x: number, _y: number, _maxWidth?: number | undefined): void {
        throw new Error('Method not implemented.');
    }
    public drawImage(image: CanvasImageSource, dx: number, dy: number): void;
    public drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
    public drawImage(
        image: CanvasImageSource,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number
    ): void;
    public drawImage(
        _image: any,
        _sx: any,
        _sy: any,
        _sw?: any,
        _sh?: any,
        _dx?: any,
        _dy?: any,
        _dw?: any,
        _dh?: any
    ) {
        throw new Error('Method not implemented.');
    }
    public createImageData(sw: number, sh: number): ImageData;
    public createImageData(imagedata: ImageData): ImageData;
    public createImageData(_sw: any, _sh?: any): ImageData {
        throw new Error('Method not implemented.');
    }
    public getImageData(_sx: number, _sy: number, _sw: number, _sh: number): ImageData {
        throw new Error('Method not implemented.');
    }
    public putImageData(imagedata: ImageData, dx: number, dy: number): void;
    public putImageData(
        imagedata: ImageData,
        dx: number,
        dy: number,
        dirtyX: number,
        dirtyY: number,
        dirtyWidth: number,
        dirtyHeight: number
    ): void;
    public putImageData(
        _imagedata: any,
        _dx: any,
        _dy: any,
        _dirtyX?: any,
        _dirtyY?: any,
        _dirtyWidth?: any,
        _dirtyHeight?: any
    ) {
        throw new Error('Method not implemented.');
    }
    public lineCap!: CanvasLineCap;
    public lineDashOffset!: number;
    public lineJoin!: CanvasLineJoin;
    public lineWidth!: number;
    public miterLimit!: number;
    public getLineDash(): number[] {
        throw new Error('Method not implemented.');
    }
    public setLineDash(_segments: number[]): void {
        throw new Error('Method not implemented.');
    }
    public direction!: CanvasDirection;
    public font!: string;
    public textAlign!: CanvasTextAlign;
    public textBaseline!: CanvasTextBaseline;
    public arc(
        _x: number,
        _y: number,
        _radius: number,
        _startAngle: number,
        _endAngle: number,
        _anticlockwise?: boolean | undefined
    ): void {
        throw new Error('Method not implemented.');
    }
    public arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number): void {
        throw new Error('Method not implemented.');
    }
    public bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public closePath(): void {
        throw new Error('Method not implemented.');
    }
    public ellipse(
        _x: number,
        _y: number,
        _radiusX: number,
        _radiusY: number,
        _rotation: number,
        _startAngle: number,
        _endAngle: number,
        _anticlockwise?: boolean | undefined
    ): void {
        throw new Error('Method not implemented.');
    }
    public lineTo(_x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public moveTo(_x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number): void {
        throw new Error('Method not implemented.');
    }
    public rect(_x: number, _y: number, _w: number, _h: number): void {
        throw new Error('Method not implemented.');
    }
}

const mockCanvas = new MockCanvas();

export function setUpDomEnvironment() {
    // tslint:disable-next-line:no-http-string
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost'
    });
    const { window } = dom;

    // tslint:disable: no-function-expression no-empty
    try {
        // If running inside of vscode, we need to mock the canvas because the real canvas is not
        // returned.
        if (require('vscode')) {
            window.HTMLCanvasElement.prototype.getContext = (contextId: string, _contextAttributes?: {}): any => {
                if (contextId === '2d') {
                    return mockCanvas;
                }
                return null;
            };
        }
    } catch {
        noop();
    }

    // tslint:disable-next-line: no-function-expression
    window.HTMLCanvasElement.prototype.toDataURL = function () {
        return '';
    };

    // tslist:disable-next-line:no-string-literal no-any
    (global as any)['Element'] = window.Element;
    // tslist:disable-next-line:no-string-literal no-any
    (global as any)['location'] = window.location;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['window'] = window;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['document'] = window.document;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['navigator'] = {
        userAgent: 'node.js',
        platform: 'node'
    };
    (global as any)['Event'] = window.Event;
    (global as any)['KeyboardEvent'] = window.KeyboardEvent;
    (global as any)['MouseEvent'] = window.MouseEvent;
    (global as any)['DocumentFragment'] = window.DocumentFragment;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['getComputedStyle'] = window.getComputedStyle;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['self'] = window;
    copyProps(window, global);

    // Special case. Monaco needs queryCommandSupported
    (global as any)['document'].queryCommandSupported = () => false;

    // Special case. Transform needs createRange
    (global as any)['document'].createRange = () => ({
        createContextualFragment: (str: string) => JSDOM.fragment(str),
        setEnd: (_endNode: any, _endOffset: any) => noop(),
        setStart: (_startNode: any, _startOffset: any) => noop(),
        getBoundingClientRect: () => null,
        getClientRects: () => []
    });

    // Another special case. CodeMirror needs selection
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['document'].selection = {
        anchorNode: null,
        anchorOffset: 0,
        baseNode: null,
        baseOffset: 0,
        extentNode: null,
        extentOffset: 0,
        focusNode: null,
        focusOffset: 0,
        isCollapsed: false,
        rangeCount: 0,
        type: '',
        addRange: (_range: Range) => noop(),
        createRange: () => null,
        collapse: (_parentNode: Node, _offset: number) => noop(),
        collapseToEnd: noop,
        collapseToStart: noop,
        containsNode: (_node: Node, _partlyContained: boolean) => false,
        deleteFromDocument: noop,
        empty: noop,
        extend: (_newNode: Node, _offset: number) => noop(),
        getRangeAt: (_index: number) => null,
        removeAllRanges: noop,
        removeRange: (_range: Range) => noop(),
        selectAllChildren: (_parentNode: Node) => noop(),
        setBaseAndExtent: (_baseNode: Node, _baseOffset: number, _extentNode: Node, _extentOffset: number) => noop(),
        setPosition: (_parentNode: Node, _offset: number) => noop(),
        toString: () => '{Selection}'
    };

    // For Jupyter server to load correctly. It expects the window object to not be defined
    // tslint:disable-next-line:no-eval no-any
    const fetchMod = eval('require')('node-fetch');
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['fetch'] = fetchMod;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['Request'] = fetchMod.Request;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['Headers'] = fetchMod.Headers;
    // tslint:disable-next-line:no-string-literal no-eval no-any
    (global as any)['WebSocket'] = eval('require')('ws');
    (global as any)['DOMParser'] = dom.window.DOMParser;
    (global as any)['Blob'] = dom.window.Blob;

    configure({ adapter: new Adapter() });

    // Special case for the node_modules\monaco-editor\esm\vs\editor\browser\config\configuration.js. It doesn't
    // export the function we need to dispose of the timer it's set. So force it to.
    const configurationRegex = /.*(\\|\/)node_modules(\\|\/)monaco-editor(\\|\/)esm(\\|\/)vs(\\|\/)editor(\\|\/)browser(\\|\/)config(\\|\/)configuration\.js/g;
    const _oldLoader = require.extensions['.js'];
    // tslint:disable-next-line:no-function-expression
    require.extensions['.js'] = function (mod: any, filename) {
        if (configurationRegex.test(filename)) {
            let content = require('fs').readFileSync(filename, 'utf8');
            content += 'export function getCSSBasedConfiguration() { return CSSBasedConfiguration.INSTANCE; };\n';
            mod._compile(content, filename);
        } else {
            _oldLoader(mod, filename);
        }
    };
}

export function setupTranspile() {
    // Some special work for getting the monaco editor to work.
    // We need to babel transpile some modules. Monaco-editor is not in commonJS format so imports
    // can't be loaded.
    require('@babel/register')({ plugins: ['@babel/transform-modules-commonjs'], only: [/monaco-editor/] });

    // Special case for editor api. Webpack bundles editor.all.js as well. Tests don't.
    require('monaco-editor/esm/vs/editor/editor.api');
    require('monaco-editor/esm/vs/editor/editor.all');
}

function copyProps(src: any, target: any) {
    const props = Object.getOwnPropertyNames(src).filter((prop) => typeof target[prop] === undefined);
    props.forEach((p: string) => {
        target[p] = src[p];
    });
}

function waitForComponentDidUpdate<P, S, C>(component: React.Component<P, S, C>): Promise<void> {
    return new Promise((resolve, reject) => {
        if (component) {
            let originalUpdateFunc = component.componentDidUpdate;
            if (originalUpdateFunc) {
                originalUpdateFunc = originalUpdateFunc.bind(component);
            }

            // tslint:disable-next-line:no-any
            component.componentDidUpdate = (prevProps: Readonly<P>, prevState: Readonly<S>, snapshot?: any) => {
                // When the component updates, call the original function and resolve our promise
                if (originalUpdateFunc) {
                    originalUpdateFunc(prevProps, prevState, snapshot);
                }

                // Reset our update function
                component.componentDidUpdate = originalUpdateFunc;

                // Finish the promise
                resolve();
            };
        } else {
            reject('Cannot find the component for waitForComponentDidUpdate');
        }
    });
}

export function waitForRender<P, S, C>(
    component: React.Component<P, S, C>,
    numberOfRenders: number = 1
): Promise<void> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise((resolve, reject) => {
        if (component) {
            let originalRenderFunc = component.render;
            if (originalRenderFunc) {
                originalRenderFunc = originalRenderFunc.bind(component);
            }
            let renderCount = 0;
            component.render = () => {
                let result: React.ReactNode = null;

                // When the render occurs, call the original function and resolve our promise
                if (originalRenderFunc) {
                    result = originalRenderFunc();
                }
                renderCount += 1;

                if (renderCount === numberOfRenders) {
                    // Reset our render function
                    component.render = originalRenderFunc;
                    resolve();
                }

                return result;
            };
        } else {
            reject('Cannot find the component for waitForRender');
        }
    });
}

export async function waitForUpdate<P, S, C>(
    wrapper: ReactWrapper<P, S, C>,
    mainClass: ComponentClass<P>,
    numberOfRenders: number = 1
): Promise<void> {
    const mainObj = wrapper.find(mainClass).instance();
    if (mainObj) {
        // Hook the render first.
        const renderPromise = waitForRender(mainObj, numberOfRenders);

        // First wait for the update
        await waitForComponentDidUpdate(mainObj);

        // Force a render
        wrapper.update();

        // Wait for the render
        await renderPromise;

        // Force a render
        wrapper.update();
    }
}

// map of string chars to keycodes and whether or not shift has to be hit
// this is necessary to generate keypress/keydown events.
// There doesn't seem to be an official way to do this (according to stack overflow)
// so just hardcoding it here.
const keyMap: { [key: string]: { code: number; shift: boolean } } = {
    A: { code: 65, shift: false },
    B: { code: 66, shift: false },
    C: { code: 67, shift: false },
    D: { code: 68, shift: false },
    E: { code: 69, shift: false },
    F: { code: 70, shift: false },
    G: { code: 71, shift: false },
    H: { code: 72, shift: false },
    I: { code: 73, shift: false },
    J: { code: 74, shift: false },
    K: { code: 75, shift: false },
    L: { code: 76, shift: false },
    M: { code: 77, shift: false },
    N: { code: 78, shift: false },
    O: { code: 79, shift: false },
    P: { code: 80, shift: false },
    Q: { code: 81, shift: false },
    R: { code: 82, shift: false },
    S: { code: 83, shift: false },
    T: { code: 84, shift: false },
    U: { code: 85, shift: false },
    V: { code: 86, shift: false },
    W: { code: 87, shift: false },
    X: { code: 88, shift: false },
    Y: { code: 89, shift: false },
    Z: { code: 90, shift: false },
    ESCAPE: { code: 27, shift: false },
    '0': { code: 48, shift: false },
    '1': { code: 49, shift: false },
    '2': { code: 50, shift: false },
    '3': { code: 51, shift: false },
    '4': { code: 52, shift: false },
    '5': { code: 53, shift: false },
    '6': { code: 54, shift: false },
    '7': { code: 55, shift: false },
    '8': { code: 56, shift: false },
    '9': { code: 57, shift: false },
    ')': { code: 48, shift: true },
    '!': { code: 49, shift: true },
    '@': { code: 50, shift: true },
    '#': { code: 51, shift: true },
    $: { code: 52, shift: true },
    '%': { code: 53, shift: true },
    '^': { code: 54, shift: true },
    '&': { code: 55, shift: true },
    '*': { code: 56, shift: true },
    '(': { code: 57, shift: true },
    '[': { code: 219, shift: false },
    '\\': { code: 209, shift: false },
    ']': { code: 221, shift: false },
    '{': { code: 219, shift: true },
    '|': { code: 209, shift: true },
    '}': { code: 221, shift: true },
    ';': { code: 186, shift: false },
    "'": { code: 222, shift: false },
    ':': { code: 186, shift: true },
    '"': { code: 222, shift: true },
    ',': { code: 188, shift: false },
    '.': { code: 190, shift: false },
    '/': { code: 191, shift: false },
    '<': { code: 188, shift: true },
    '>': { code: 190, shift: true },
    '?': { code: 191, shift: true },
    '`': { code: 192, shift: false },
    '~': { code: 192, shift: true },
    ' ': { code: 32, shift: false },
    '\n': { code: 13, shift: false },
    '\r': { code: 0, shift: false } // remove \r from the text.
};

export function createMessageEvent(data: any): MessageEvent {
    const domWindow = (window as any) as DOMWindow;
    return new domWindow.MessageEvent('message', { data });
}

export function createKeyboardEvent(type: string, options: KeyboardEventInit): KeyboardEvent {
    const domWindow = (window as any) as DOMWindow;
    options.bubbles = true;
    options.cancelable = true;

    // charCodes and keyCodes are different things. Compute the keycode for cm to work.
    // This is the key (on an english qwerty keyboard) that would have to be hit to generate the key
    // This site was a great help with the mapping:
    // https://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    const upper = options.key!.toUpperCase();
    const keyCode = keyMap.hasOwnProperty(upper) ? keyMap[upper].code : options.key!.charCodeAt(0);
    const shift = keyMap.hasOwnProperty(upper) ? keyMap[upper].shift || options.shiftKey : options.shiftKey;

    // JSDOM doesn't support typescript so well. The options are supposed to be flexible to support just about anything, but
    // the type KeyboardEventInit only supports the minimum. Stick in extras with some typecasting hacks
    return new domWindow.KeyboardEvent(type, ({ ...options, keyCode, shiftKey: shift } as any) as KeyboardEventInit);
}

export function createInputEvent(): Event {
    const domWindow = (window as any) as DOMWindow;
    return new domWindow.Event('input', { bubbles: true, cancelable: false });
}

export function blurWindow() {
    // blur isn't implemented. We just need to dispatch the blur event
    const domWindow = (window as any) as DOMWindow;
    const blurEvent = new domWindow.Event('blur', { bubbles: true });
    domWindow.dispatchEvent(blurEvent);
}
