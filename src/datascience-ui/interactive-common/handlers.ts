// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export function handleLinkClick(ev: MouseEvent, linkClick: (href: string) => void) {
    // If this is an anchor element, forward the click as Jupyter does.
    let anchor = ev.target as HTMLAnchorElement;
    if (anchor && anchor.href) {
        // Href may be redirected to an inner anchor
        if (anchor.href.startsWith('vscode') || anchor.href.startsWith(anchor.baseURI)) {
            const inner = anchor.getElementsByTagName('a');
            if (inner && inner.length > 0) {
                anchor = inner[0];
            }
        }
        if (!anchor || !anchor.href || anchor.href.startsWith('vscode')) {
            return;
        }

        // Don't want a link click to cause a refresh of the webpage
        ev.stopPropagation();
        ev.preventDefault();

        // Look for a blob link.
        if (!anchor.href.startsWith('blob:')) {
            linkClick(anchor.href);
        } else {
            // We an have an image (as a blob) and the reference is blob://null:<someguid>
            // We need to get the blob, for that make a http request and the response will be the Blob
            // Next convert the blob into something that can be sent to the client side.
            // Just send an inlined base64 image to `linkClick`, such as `data:image/png;base64,xxxxx`
            const xhr = new XMLHttpRequest();
            xhr.open('GET', anchor.href, true);
            xhr.responseType = 'blob';
            xhr.onload = () => {
                const blob = xhr.response;
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        linkClick(reader.result);
                    }
                };
            };
            xhr.send();
        }
    }
}
