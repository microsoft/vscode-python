// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Temporary work around for https://github.com/microsoft/vscode/issues/98106
// tslint:disable

const scriptSrcs = Array.from(document.querySelectorAll('script'))
    .map((item) => item.attributes.getNamedItem('src'))
    .filter((item) => (item?.value || '').endsWith('pvscDummy.js'))
    .map((item) => item?.value)
    .filter((item) => !!item);

if (scriptSrcs.length) {
    try {
        const src = scriptSrcs[0]!;
        const paths = src.split('/');
        // Remove file name portion from path.
        paths.pop();
        Object.assign(window, { __PVSC_Public_Path: `${paths.join('/')}/` });
        console.log(`window.__PVSC_Public_Path = ${(window as any).__PVSC_Public_Path}`);
    } catch (ex) {
        console.error('Unable to initialize window.__PVSC_Public_Path', ex);
    }
} else {
    console.error('Unable to initialize window.__PVSC_Public_Path');
}
