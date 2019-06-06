// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';

interface IReactFromHtmlProps {
    html: string;
}

export class ReactFromHtml extends React.Component<IReactFromHtmlProps> {
    private divRef : React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private innerRef: HTMLElement | undefined;

    constructor(props: IReactFromHtmlProps) {
        super(props);
    }

    public componentDidMount() {
        if (this.divRef && this.divRef.current) {
            this.attachHtml(this.divRef.current)
        }
    }

    public shouldComponentUpdate(nextProps: IReactFromHtmlProps): boolean {
        return nextProps.html !== this.props.html;
    }

    public componentDidUpdate() {
        if (this.innerRef) {
            this.attachHtml(this.innerRef);
        }
    }

    public render() {
        return (
            <div ref={this.divRef} />
        );
    }

    private attachHtml(element: HTMLElement) {
        // Remove the element from the dom
        const parent = element.parentElement;
        element.remove();
        if (parent !== null && parent.ownerDocument !== null) {
            // Generate a new node with our html in it.
            const template = parent.ownerDocument.createElement('template') as HTMLTemplateElement;
            // tslint:disable-next-line: no-inner-html
            template.innerHTML = this.props.html;
            if (template.firstChild) {
                this.innerRef = template.firstChild as HTMLElement;
                parent.appendChild(template.firstChild);
            }
        }
    }
}
