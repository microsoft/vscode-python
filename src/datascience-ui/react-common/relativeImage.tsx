// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as path from 'path';
import * as React from 'react';

// This special function finds relative paths when loading inside of vscode. It's not defined
// when loading outside, so the Image component should still work.
export declare function resolvePath(relativePath: string): string;

interface IRelativeImageProps {
    class: string;
    path: string;
}

export class RelativeImage extends React.Component<IRelativeImageProps> {
    constructor(props: IRelativeImageProps) {
        super(props);
    }

    public render() {
        return <img src={this.getImageSource()} className={this.props.class} alt={path.basename(this.props.path)} />;
    }

    private getImageSource = () => {
        // tslint:disable-next-line:no-typeof-undefined
        if (typeof resolvePath === 'undefined') {
            return this.props.path;
        } else {
            return resolvePath(this.props.path);
        }
    };
}
