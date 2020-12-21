// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

declare let __webpack_public_path__: string;

if ((window as any).__PVSC_Public_Path) {
    // This variable tells Webpack to this as the root path used to request webpack bundles.

    __webpack_public_path__ = (window as any).__PVSC_Public_Path;
}
