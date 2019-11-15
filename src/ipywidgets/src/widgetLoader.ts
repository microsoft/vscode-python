// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// This is the magic that allows us to load 3rd party widgets.
// If a widget isn't found locally, lets try to get the required files from `unpkg.com`.
// For some reason this isn't the default behavior of the html manager.

// Source borrowed from https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3/src/manager.ts

const cdn = 'https://unpkg.com/';

function moduleNameToCDNUrl(moduleName: string, moduleVersion: string) {
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

// tslint:disable-next-line: no-any
async function requirePromise(pkg: string | string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        // tslint:disable-next-line: no-any
        const requirejs = (window as any).requirejs;
        if (requirejs === undefined) {
            reject('Requirejs is needed, please ensure it is loaded on the page.');
        } else {
            requirejs(pkg, resolve, reject);
        }
    });
}

export function requireLoader(moduleName: string, moduleVersion: string) {
    // tslint:disable-next-line: no-any
    const requirejs = (window as any).requirejs;
    if (requirejs === undefined) {
        throw new Error('Requirejs is needed, please ensure it is loaded on the page.');
    }
    const conf: { paths: { [key: string]: string } } = { paths: {} };
    conf.paths[moduleName] = moduleNameToCDNUrl(moduleName, moduleVersion);
    requirejs.config(conf);

    return requirePromise([`${moduleName}`]);
}
