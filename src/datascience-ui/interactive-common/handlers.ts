// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export function handleLinkClick(ev: MouseEvent, linkClick: (href: string) => void) {
    // If this is an anchor element, forward the click as Jupyter does.
    let anchor = ev.target as HTMLAnchorElement;
    if (anchor && anchor.href) {
        // Href may be redirected to an inner anchor
        if (anchor.href.startsWith('vscode')) {
            const inner = anchor.getElementsByTagName('a');
            if (inner && inner.length > 0) {
                anchor = inner[0];
            }
        }
        if (anchor && anchor.href && !anchor.href.startsWith('vscode')) {
            linkClick(anchor.href);
        }
    }
}
