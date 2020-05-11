// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import { connect } from 'react-redux';
import { IStartPageMapping, StartPageMessages } from '../../client/datascience/startPage/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { PostOffice } from '../react-common/postOffice';
// import { IMainWithVariables } from '../interactive-common/redux/store';
import { actionCreators } from './redux/actions';
import './startPage.css';

// type IStartPageProps = IMainWithVariables & typeof actionCreators;
export type IDefaultState = {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
    postOffice: PostOffice;
};

export type IStartPageProps = IDefaultState & typeof actionCreators;

export class StartPage extends React.Component<IStartPageProps> {
    private checked = false;
    private postOffice: PostOffice = new PostOffice();

    constructor(props: IStartPageProps) {
        super(props);
    }

    public componentDidMount() {
        this.props.requestReleaseNotes();
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the plot viewer code we have started.
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.Started);

        // Listen to key events
        // window.addEventListener('keydown', this.onKeyDown);
    }

    public render() {
        return (
            <div className="main-page">
                <div className="title-row">
                    <div className="title-icon">
                        <Image
                            baseTheme={this.props.baseTheme}
                            class="image-button-image"
                            image={ImageName.PythonColor}
                        />
                    </div>
                    <div className="title">
                        {getLocString('DataScience.startPage.PythonExtensionTitle', 'Python Extension')}
                    </div>
                </div>
                <div className="row">
                    <div className="icon">
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Notebook}
                        />
                    </div>
                    <div className="block">
                        <div className="text">Create a Jupyter Notebook</div>
                        <div className="paragraph">
                            - Use "<div className="italics">Shift + Command + P </div>" to open the{' '}
                            <div className="link" role="button" onClick={this.sendMessage}>
                                Command Palette
                            </div>
                            <br />- Type "
                            <div className="link italics" role="button" onClick={this.sendMessage}>
                                Create new blank Jupyter notebook
                            </div>{' '}
                            "
                            <br />- Explore our{' '}
                            <div className="link" role="button" onClick={this.sendMessage}>
                                sample notebook
                            </div>{' '}
                            to learn about notebook features
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="icon">
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Python}
                        />
                    </div>
                    <div className="block">
                        <div className="text">Create a Python File</div>
                        <div className="paragraph">
                            - Create a new file and use the .py extension
                            <br />-{' '}
                            <div className="link" role="button" onClick={this.sendMessage}>
                                Open a file or workspace
                            </div>{' '}
                            to continue work
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="icon">
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Interactive}
                        />
                    </div>
                    <div className="block">
                        <div className="text">Open the interactive Window</div>
                        <p>
                            - You can create cells on a python file by typing "#%%"
                            <br />- Use "Shift + Enter" to run a cell, the output will be shown in the interactive
                            window
                        </p>
                    </div>
                </div>
                <div className="row">
                    <div className="paragraph">
                        Take a look at our{' '}
                        <div className="link" role="button" onClick={this.sendMessage}>
                            {this.getCurrentReleaseVersion()} Release Notes
                        </div>{' '}
                        to learn more about the latest features
                    </div>
                    {this.renderReleaseNotes()}
                    <div className="paragraph">
                        Explore more features in our{' '}
                        <div className="link" role="button" onClick={this.sendMessage}>
                            Tutorials
                        </div>{' '}
                        or check{' '}
                        <div className="link" role="button" onClick={this.sendMessage}>
                            Documentation
                        </div>{' '}
                        for tips and troubleshooting.
                    </div>
                </div>
                <div className="block">
                    <input type="checkbox" aria-checked={this.checked} className="checkbox"></input>
                </div>
                <div className="block">
                    <p>Don't show this page again</p>
                </div>
            </div>
        );
    }

    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case StartPageMessages.ReceivedReleaseNotes:
                console.log('yes');
                break;

            default:
                break;
        }

        return false;
    };

    private sendMessage = (evt: React.SyntheticEvent<HTMLElement>) => {
        // tslint:disable-next-line: no-console
        // console.log(evt);
        // location.reload();
        this.props.requestReleaseNotes();
    };

    private getCurrentReleaseVersion(): string {
        return 'get month and year';
    }

    private renderReleaseNotes(): JSX.Element {
        // const releaseNotes = this.props.requestReleaseNotes();
        const releaseNotes = ['1', '2', '3'];
        const notes: JSX.Element[] = [];
        releaseNotes.forEach((rel, index) => {
            notes.push(<li key={index}>{rel}</li>);
        });
        return <ul>{notes}</ul>;
    }
}

function mapStateToProps(state: IStartPageProps): IStartPageProps {
    return state;
}

export function getConnectedStartPage() {
    return connect(mapStateToProps, actionCreators)(StartPage);
}
