// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import { IReleaseNotesPackage, IStartPageMapping, StartPageMessages } from '../../client/datascience/startPage/types';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import './startPage.css';

export interface IStartPageProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

interface IStartPageState {
    settings?: IDataScienceExtraSettings;
}

export class StartPage extends React.Component<IStartPageProps, IStartPageState> implements IMessageHandler {
    private checked = false;
    private releaseNotes: IReleaseNotesPackage = {
        date: '',
        notes: []
    };
    private postOffice: PostOffice = new PostOffice();

    constructor(props: IStartPageProps) {
        super(props);
    }

    public componentDidMount() {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.RequestReleaseNotes);
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the plot viewer code we have started.
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.Started);
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
                    <div className="icon" onClick={this.openBlankNotebook} role="button">
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
                            <div className="link" role="button" onClick={this.openFileBrowser}>
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
                        <a className="link" href="https://aka.ms/AA8dxtb">
                            {this.getCurrentReleaseVersion()} Release Notes
                        </a>{' '}
                        to learn more about the latest features
                    </div>
                    {this.renderReleaseNotes()}
                    <div className="paragraph">
                        Explore more features in our{' '}
                        <a className="link" href="https://aka.ms/AA8dqti">
                            Tutorials
                        </a>{' '}
                        or check{' '}
                        <a className="link" href="https://aka.ms/AA8dxwy">
                            Documentation
                        </a>{' '}
                        for tips and troubleshooting.
                    </div>
                </div>
                <div className="row">
                    <div className="block">
                        <input type="checkbox" aria-checked={this.checked} className="checkbox"></input>
                    </div>
                    <div className="block">
                        <p>Don't show this page again</p>
                    </div>
                </div>
            </div>
        );
    }

    // tslint:disable-next-line: no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case StartPageMessages.SendReleaseNotes:
                this.releaseNotes.date = payload.date;
                this.releaseNotes.notes = payload.notes;
                this.setState({});
                break;

            default:
                break;
        }

        return false;
    };

    private sendMessage = (evt: React.SyntheticEvent<HTMLElement>) => {
        // tslint:disable-next-line: no-console
        console.log(evt);
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.RequestReleaseNotes);
    };

    private openBlankNotebook = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankNotebook);
    };

    private openFileBrowser = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFileBrowser);
    };

    private getCurrentReleaseVersion(): string {
        return this.releaseNotes.date;
    }

    private renderReleaseNotes(): JSX.Element {
        const notes: JSX.Element[] = [];
        this.releaseNotes.notes.forEach((rel, index) => {
            notes.push(<li key={index}>{rel}</li>);
        });
        return <ul>{notes}</ul>;
    }
}
