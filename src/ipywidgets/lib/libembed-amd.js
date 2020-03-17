// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import * as libembed from './libembed';
let cdn = 'https://unpkg.com/';
// find the data-cdn for any script tag, assuming it is only used for embed-amd.js
const scripts = document.getElementsByTagName('script');
Array.prototype.forEach.call(scripts, (script) => {
    cdn = script.getAttribute('data-jupyter-widgets-cdn') || cdn;
});
/**
 * Load a package using requirejs and return a promise
 *
 * @param pkg Package name or names to load
 */
let requirePromise = function (pkg) {
    return new Promise((resolve, reject) => {
        let require = window.requirejs;
        if (require === undefined) {
            reject("Requirejs is needed, please ensure it is loaded on the page.");
        }
        else {
            require(pkg, resolve, reject);
        }
    });
};
function moduleNameToCDNUrl(moduleName, moduleVersion) {
    let packageName = moduleName;
    let fileName = 'index'; // default filename
    // if a '/' is present, like 'foo/bar', packageName is changed to 'foo', and path to 'bar'
    // We first find the first '/'
    let index = moduleName.indexOf('/');
    if ((index != -1) && (moduleName[0] == '@')) {
        // if we have a namespace, it's a different story
        // @foo/bar/baz should translate to @foo/bar and baz
        // so we find the 2nd '/'
        index = moduleName.indexOf('/', index + 1);
    }
    if (index != -1) {
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
export function requireLoader(moduleName, moduleVersion) {
    return requirePromise([`${moduleName}`]).catch((err) => {
        let failedId = err.requireModules && err.requireModules[0];
        if (failedId) {
            console.log(`Falling back to ${cdn} for ${moduleName}@${moduleVersion}`);
            let require = window.requirejs;
            if (require === undefined) {
                throw new Error("Requirejs is needed, please ensure it is loaded on the page.");
            }
            const conf = { paths: {} };
            conf.paths[moduleName] = moduleNameToCDNUrl(moduleName, moduleVersion);
            require.undef(failedId);
            require.config(conf);
            return requirePromise([`${moduleName}`]);
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
export function renderWidgets(element = document.documentElement, loader = requireLoader) {
    requirePromise(['@jupyter-widgets/html-manager']).then((htmlmanager) => {
        let managerFactory = () => {
            return new htmlmanager.HTMLManager({ loader: loader });
        };
        libembed.renderWidgets(managerFactory, element);
    });
}
