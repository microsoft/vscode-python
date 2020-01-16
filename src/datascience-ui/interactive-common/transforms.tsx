/* tslint:disable */
import * as React from 'react';
import Loadable, { LoadableComponent } from '@loadable/component';

interface ITransformData {
    mimeType: string;
    loader: () => Promise<any>;
}

// Hardcode mimeType here so we can do a quick lookup without loading all of the
// other components.
const mimeTypeToImport: ITransformData[] = [
    { 
        mimeType: 'application/vnd.vega.v2+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.Vega2;
        }
    },
    { 
        mimeType: 'application/vnd.vega.v3+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.Vega3;
        }
    },
    { 
        mimeType: 'application/vnd.vega.v4+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.Vega4;
        }
    },
    { 
        mimeType: 'application/vnd.vega.v5+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.Vega5;
        }
    },
    { 
        mimeType: 'application/vnd.vegalite.v1+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.VegaLite1;
        }
    },
    { 
        mimeType: 'application/vnd.vegalite.v2+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.VegaLite2;
        }
    },
    { 
        mimeType: 'application/vnd.vegalite.v3+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "vega" */ '@nteract/transform-vega');
            return module.VegaLite3;
        }
    },
    {
        mimeType: 'application/geo+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "geojson" */ '@nteract/transform-geojson');
            return module.GeoJSONTransform;
        }
    },
    {
        mimeType: 'application/vnd.dataresource+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "geojson" */ '@nteract/transform-dataresource');
            return module.DataResourceTransform;
        }
    },
    {
        mimeType: 'application/x-nteract-model-debug+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "geojson" */ '@nteract/transform-model-debug');
            return module.default;
        }

    },
    {
        mimeType: 'text/vnd.plotly.v1+html',
        loader: async () => {
            const module = await import(/* webpackChunkName: "geojson" */ '@nteract/transform-plotly');
            return module.PlotlyNullTransform;
        }

    },
    {
        mimeType: 'application/vnd.plotly.v1+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "geojson" */ '@nteract/transform-plotly');
            return module.PlotlyTransform;
        }

    },
    { 
        mimeType: 'image/svg',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.SVGTransform;
        }
    },
    { 
        mimeType: 'image/png',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.PNGTransform;
        }
    },
    { 
        mimeType: 'image/gif',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.GIFTransform;
        }
    },
    { 
        mimeType: 'image/jpeg',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.JPEGTransform;
        }
    },
    { 
        mimeType: 'application/json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.JSONTransform;
        }
    },
    { 
        mimeType: 'application/javascript',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.JavaScriptTransform;
        }
    },
    { 
        mimeType: 'application/vdom.v1+json',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transform-vdom');
            return module.VDOM;
        }
    },
    { 
        mimeType: 'text/markdown',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.MarkdownTransform;
        }
    },
    { 
        mimeType: 'text/latex',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.LaTeXTransform;
        }
    },
    { 
        mimeType: 'text/html',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.HTMLTransform;
        }
    },
    { 
        mimeType: 'text/plain',
        loader: async () => {
            const module = await import(/* webpackChunkName: "nteract_transforms" */ '@nteract/transforms');
            return module.TextTransform;
        }
    }
];

export function getRichestMimetype(data: any): string {
    // Go through the keys of this object and find their index in the map
    let index = mimeTypeToImport.length;
    const keys = Object.keys(data);
    keys.forEach(k => {
        const keyIndex = mimeTypeToImport.findIndex(m => m.mimeType === k);
        if (keyIndex >= 0 && keyIndex < index) {
            // If higher up the chain, pick the higher up key
            index = keyIndex;
        }
    });

    // If this index is found, return the mimetype to use.
    if (index < mimeTypeToImport.length) {
        return mimeTypeToImport[index].mimeType;
    }

    // Don't know which to pick, just pick the first.
    return keys[0];
}

export function getTransform(mimeType: string): LoadableComponent<{ data: any }> {
    return Loadable<{data: any}>(async () => {
        const match = mimeTypeToImport.find(m => m.mimeType === mimeType);
        if (match) {
            const transform = await match.loader();
            return transform;
        }

        return <div>`Transform not found for mimetype ${mimeType}`</div>;
    }, { fallback: <div>Loading ...</div> });
}
