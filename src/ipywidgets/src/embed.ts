// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
// tslint:disable: no-var-requires no-require-imports no-any
import * as libembed from './libembed';
import * as wm from './manager';

let cdn = 'https://unpkg.com/';
let onlyCDN = false;

// find the data-cdn for any script tag, assuming it is only used for embed-amd.js
const scripts = document.getElementsByTagName('script');
Array.prototype.forEach.call(scripts, (script: HTMLScriptElement) => {
    cdn = script.getAttribute('data-jupyter-widgets-cdn') || cdn;
    onlyCDN = onlyCDN || script.hasAttribute('data-jupyter-widgets-cdn-only');
});

/**
 * Load a package using requirejs and return a promise
 *
 * @param pkg Package name or names to load
 */
// tslint:disable-next-line: no-function-expression
const requirePromise = function (pkg: string | string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        const require = (window as any).requirejs;
        if (require === undefined) {
            reject('Requirejs is needed, please ensure it is loaded on the page.');
        } else {
            // tslint:disable-next-line: non-literal-require
            require(pkg, resolve, reject);
        }
    });
};

function moduleNameToCDNUrl(moduleName: string, moduleVersion: string): string {
    let packageName = moduleName;
    let fileName = 'index'; // default filename
    // if a '/' is present, like 'foo/bar', packageName is changed to 'foo', and path to 'bar'
    // We first find the first '/'
    let index = moduleName.indexOf('/');
    if (index !== -1 && moduleName[0] === '@') {
        // if we have a namespace, it's a different story
        // @foo/bar/baz should translate to @foo/bar and baz
        // so we find the 2nd '/'
        index = moduleName.indexOf('/', index + 1);
    }
    if (index !== -1) {
        fileName = moduleName.substr(index + 1);
        packageName = moduleName.substr(0, index);
    }
    return `${cdn}${packageName}@${moduleVersion}/dist/${fileName}`;
}

/**
 * Load an amd module locally and fall back to specified CDN if unavailable.
 *
 * @param moduleName The name of the module to load..
 * @param version The semver range for the module, if loaded from a CDN.
 *
 * By default, the CDN service used is unpkg.com. However, this default can be
 * overriden by specifying another URL via the HTML attribute
 * "data-jupyter-widgets-cdn" on a script tag of the page.
 *
 * The semver range is only used with the CDN.
 */
export function requireLoader(moduleName: string, moduleVersion: string): Promise<any> {
    const require = (window as any).requirejs;
    if (require === undefined) {
        throw new Error('Requirejs is needed, please ensure it is loaded on the page.');
    }
    function loadFromCDN(): Promise<any> {
        const conf: { paths: { [key: string]: string } } = { paths: {} };
        conf.paths[moduleName] = moduleNameToCDNUrl(moduleName, moduleVersion);
        require.config(conf);
        return requirePromise([`${moduleName}`]);
    }
    if (onlyCDN) {
        window.console.log(`Loading from ${cdn} for ${moduleName}@${moduleVersion}`);
        return loadFromCDN();
    }
    return requirePromise([`${moduleName}`]).catch((err) => {
        const failedId = err.requireModules && err.requireModules[0];
        if (failedId) {
            require.undef(failedId);
            window.console.log(`Falling back to ${cdn} for ${moduleName}@${moduleVersion}`);
            loadFromCDN().catch((x) => {
                window.console.error(x);
            });
        }
    });
}

/**
 * Render widgets in a given element.
 *
 * @param element (default document.documentElement) The element containing widget state and views.
 * @param loader (default requireLoader) The function used to look up the modules containing
 * the widgets' models and views classes. (The default loader looks them up on unpkg.com)
 */
export function renderWidgets(element = document.documentElement): void {
    const managerFactory = (): any => {
        return new wm.WidgetManager(undefined, element, () => 'Error loading widget.');
    };
    libembed.renderWidgets(managerFactory, element).catch((x) => {
        window.console.error(x);
    });
}
