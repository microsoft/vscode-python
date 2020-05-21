// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import { IReleaseNotesPackage, IStartPageMapping, StartPageMessages } from '../../client/datascience/startPage/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import './startPage.css';

export interface IStartPageProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

// Front end of the Pyhton extension start page.
// In general it consists of its render method and methods that send and receive messages.
export class StartPage extends React.Component<IStartPageProps> implements IMessageHandler {
    private doNotShowAgain = false;
    private releaseNotes: IReleaseNotesPackage = {
        date: '',
        notes: []
    };
    private postOffice: PostOffice = new PostOffice();
    private iconClass: string;

    constructor(props: IStartPageProps) {
        super(props);
        this.iconClass = this.props.baseTheme === 'vscode-dark' ? 'icon icon-dark' : 'icon icon-light';
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
        // tslint:disable: react-a11y-anchors
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
                        {getLocString('DataScience.startPage.pythonExtensionTitle', 'Python Extension')}
                    </div>
                </div>
                <div className="row">
                    <div className={this.iconClass} onClick={this.openBlankNotebook} role="button">
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Notebook}
                        />
                    </div>
                    <div className="block">
                        <div className="text">
                            {getLocString('DataScience.startPage.CreateJupyterNotebook', 'Create a Jupyter Notebook')}
                        </div>
                        <div className="paragraph">
                            {getLocString('DataScience.startPage.use', '- Use "')}
                            <div className="italics">
                                {getLocString('DataScience.startPage.shiftCommandP', 'Shift + Command + P ')}
                            </div>
                            {getLocString('DataScience.startPage.toOpenThe', '" to open the')}{' '}
                            <div className="link" role="button" onClick={this.openCommandPalette}>
                                {getLocString('DataScience.startPage.commandPalette', 'Command Palette')}
                            </div>
                            <br />
                            {getLocString('DataScience.startPage.type', '- Type "')}
                            <div className="link italics" role="button" onClick={this.openCommandPaletteWithSelection}>
                                {getLocString(
                                    'python.command.python.datascience.createnewnotebook.title',
                                    'Create New Blank Jupyter Notebook'
                                )}
                            </div>{' '}
                            "
                            <br />
                            {getLocString('DataScience.startPage.exploreOur', '- Explore our')}{' '}
                            <div className="link" role="button" onClick={this.openSampleNotebook}>
                                {getLocString('DataScience.startPage.sampleNotebook', 'sample notebook')}
                            </div>{' '}
                            {getLocString('DataScience.startPage.toLearn', 'to learn about notebook features')}
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className={this.iconClass} role="button" onClick={this.createPythonFile}>
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Python}
                        />
                    </div>
                    <div className="block">
                        <div className="text">
                            {getLocString('DataScience.startPage.createAPythonFile', 'Create a Python File')}
                        </div>
                        <div className="paragraph">
                            {getLocString(
                                'DataScience.startPage.createANewFile',
                                '- Create a new file and use the .py extension'
                            )}
                            <br />-{' '}
                            <div className="link" role="button" onClick={this.openFileBrowser}>
                                {getLocString('DataScience.startPage.openFileOrWorkspace', 'Open a file or workspace')}
                            </div>{' '}
                            {getLocString('DataScience.startPage.continueWork', 'to continue work')}
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className={this.iconClass} role="button" onClick={this.openInteractiveWindow}>
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Interactive}
                        />
                    </div>
                    <div className="block">
                        <div className="text">
                            {getLocString('DataScience.startPage.openInteractiveWindow', 'Open the interactive Window')}
                        </div>
                        <p>
                            {getLocString(
                                'DataScience.startPage.interactiveWindowDesc',
                                '- You can create cells on a python file by typing "#%%"'
                            )}
                            <br />
                            {getLocString(
                                'DataScience.startPage.interactiveWindowDesc2',
                                '- Use "Shift + Enter" to run a cell, the output will be shown in the interactive window'
                            )}
                        </p>
                    </div>
                </div>
                <div className="row">
                    <div className="paragraph">
                        {getLocString('DataScience.startPage.takeALook', 'Take a look at our')}{' '}
                        <a className="link" href="https://aka.ms/AA8dxtb">
                            {this.getCurrentReleaseVersion()}{' '}
                            {getLocString('DataScience.startPage.releaseNotes', 'Release Notes')}
                        </a>{' '}
                        {getLocString('DataScience.startPage.toLearnMore', 'to learn more about the latest features')}
                    </div>
                    {this.renderReleaseNotes()}
                    <div className="paragraph">
                        {getLocString('DataScience.startPage.exploreMoreFeatures', 'Explore more features in our')}{' '}
                        <a className="link" href="https://aka.ms/AA8dqti">
                            {getLocString('DataScience.startPage.tutorials', 'Tutorials')}
                        </a>{' '}
                        {getLocString('DataScience.startPage.orCheck', 'or check')}{' '}
                        <a className="link" href="https://aka.ms/AA8dxwy">
                            {getLocString('DataScience.startPage.documentation', 'Documentation')}
                        </a>{' '}
                        {getLocString('DataScience.startPage.forTips', 'for tips and troubleshooting.')}
                    </div>
                </div>
                <div className="block">
                    <input
                        type="checkbox"
                        aria-checked={this.doNotShowAgain}
                        className="checkbox"
                        onClick={this.updateSettings}
                    ></input>
                </div>
                <div className="block">
                    <p>{getLocString('DataScience.startPage.dontShowAgain', "Don't show this page again")}</p>
                </div>
            </div>
        );
    }

    // tslint:disable-next-line: no-any
    public handleMessage = (msg: string, payload?: any) => {
        if (msg === StartPageMessages.SendReleaseNotes) {
            this.releaseNotes.date = payload.date;
            this.releaseNotes.notes = payload.notes;
            this.setState({});
        }

        if (msg === StartPageMessages.UpdateSettings) {
            let settings;
            try {
                settings = JSON.parse(payload);
            } catch {
                settings = undefined;
            }

            if (
                settings &&
                settings.extraSettings &&
                settings.extraSettings.theme &&
                (settings.extraSettings.theme as string).toLowerCase().includes('light')
            ) {
                this.iconClass = 'icon icon-light';
            } else {
                this.iconClass = 'icon icon-dark';
            }
            this.setState({});
        }

        return false;
    };

    private openBlankNotebook = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankNotebook);
    };

    private openFileBrowser = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFileBrowser);
    };

    private createPythonFile = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankPythonFile);
    };

    private openCommandPalette = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenCommandPalette);
    };

    private openCommandPaletteWithSelection = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenCommandPaletteWithOpenNBSelected);
    };

    private openSampleNotebook = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenSampleNotebook);
    };

    private openInteractiveWindow = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenInteractiveWindow);
    };

    private updateSettings = () => {
        this.doNotShowAgain = !this.doNotShowAgain;
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.UpdateSettings, !this.doNotShowAgain);
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
