// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

let canvas: HTMLCanvasElement | undefined;

function getCanvas(): HTMLCanvasElement {
    if (!canvas) {
        canvas = document.createElement('canvas');
    }
    return canvas;
}

export function measureText(text: string, font: string | null): number {
    const context = getCanvas().getContext('2d');
    if (context) {
        if (font) {
            context.font = font;
        }
        const metrics = context.measureText(text);
        return metrics.width;
    }
    return 0;
}
