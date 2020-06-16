// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import '../../client/common/extensions';
import { IReleaseNotesPackage, IStartPageMapping, StartPageMessages } from '../../client/common/startPage/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import './startPage.css';

export interface IStartPageProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

// Front end of the Python extension start page.
// In general it consists of its render method and methods that send and receive messages.
export class StartPage extends React.Component<IStartPageProps> implements IMessageHandler {
    private releaseNotes: IReleaseNotesPackage = {
        notes: [],
        showAgainSetting: false
    };
    private postOffice: PostOffice = new PostOffice();

    constructor(props: IStartPageProps) {
        super(props);
    }

    public componentDidMount() {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.RequestReleaseNotesAndShowAgainSetting);
    }

    // tslint:disable: no-any
    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the start page code we have started.
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.Started);

        // Bind some functions to the window, as we need them to be accessible with clean HTML to use translations
        (window as any).openBlankNotebook = this.openBlankNotebook.bind(this);
        (window as any).createPythonFile = this.createPythonFile.bind(this);
        (window as any).openFileBrowser = this.openFileBrowser.bind(this);
        (window as any).openFolder = this.openFolder.bind(this);
        (window as any).openWorkspace = this.openWorkspace.bind(this);
        (window as any).openCommandPalette = this.openCommandPalette.bind(this);
        (window as any).openCommandPaletteWithSelection = this.openCommandPaletteWithSelection.bind(this);
        (window as any).openSampleNotebook = this.openSampleNotebook.bind(this);
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
                    <div className="title">{getLocString('StartPage.pythonExtensionTitle', 'Python Extension')}</div>
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
                        <div className="text" onClick={this.openBlankNotebook} role="button">
                            {getLocString('StartPage.CreateJupyterNotebook', 'Create a Jupyter Notebook')}
                        </div>
                        {this.renderNotebookDescription()}
                    </div>
                </div>
                <div className="row">
                    <div className="icon" role="button" onClick={this.createPythonFile}>
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Python}
                        />
                    </div>
                    <div className="block">
                        <div className="text" role="button" onClick={this.createPythonFile}>
                            {getLocString('StartPage.createAPythonFile', 'Create a Python File')}
                        </div>
                        {this.renderPythonFileDescription()}
                    </div>
                </div>
                <div className="row">
                    <div className="icon" role="button" onClick={this.openFolder}>
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.OpenFolder}
                        />
                    </div>
                    <div className="block">
                        <div className="text" role="button" onClick={this.openFolder}>
                            {getLocString('StartPage.openFolder', 'Open a Folder or Workspace')}
                        </div>
                        {this.renderFolderDescription()}
                    </div>
                </div>
                <div className="row">
                    <div className="icon" role="button" onClick={this.openInteractiveWindow}>
                        <Image
                            baseTheme={this.props.baseTheme ? this.props.baseTheme : 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Interactive}
                        />
                    </div>
                    <div className="block">
                        <div className="text" role="button" onClick={this.openInteractiveWindow}>
                            {getLocString(
                                'StartPage.openInteractiveWindow',
                                'Use the Interactive Window to develop Python Scripts'
                            )}
                        </div>
                        {this.renderInteractiveWindowDescription()}
                    </div>
                </div>
                <div className="row">
                    {this.renderReleaseNotesLink()}
                    {this.renderReleaseNotes()}
                    {this.renderTutorialAndDoc()}
                </div>
                <div className="block">
                    <input
                        type="checkbox"
                        aria-checked={!this.releaseNotes.showAgainSetting}
                        className="checkbox"
                        onClick={this.updateSettings}
                    ></input>
                </div>
                <div className="block">
                    <p>{getLocString('StartPage.dontShowAgain', "Don't show this page again")}</p>
                </div>
            </div>
        );
    }

    // tslint:disable-next-line: no-any
    public handleMessage = (msg: string, payload?: any) => {
        if (msg === StartPageMessages.SendReleaseNotes) {
            this.releaseNotes.notes = payload.notes;
            this.releaseNotes.showAgainSetting = payload.showAgainSetting;
            this.setState({});
        }

        return false;
    };

    public openFileBrowser() {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFileBrowser);
    }

    public openFolder = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFolder);
    };

    public openWorkspace() {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenWorkspace);
    }

    private renderNotebookDescription(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph list"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.notebookDescription',
                        '- Run "<div class="link italics" role="button" onclick={0}>Create New Blank Jupyter Notebook</div>" in the Command Palette (<div class="italics">Shift + Command + P</div>)<br />- Explore our <div class="link" role="button" onclick={1}>sample notebook</div> to learn about notebook features'
                    ).format('openCommandPaletteWithSelection()', 'openSampleNotebook()')
                }}
            />
        );
    }

    private renderPythonFileDescription(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph list"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.pythonFileDescription',
                        '- Create a <div class="link" role="button" onclick={0}>new file</div> with a .py extension'
                    ).format('createPythonFile()')
                }}
            />
        );
    }

    private renderInteractiveWindowDescription(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph list"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.interactiveWindowDesc',
                        '- You can create cells on a Python file by typing "#%%" <br /> - Use "<div class="italics">Shift + Enter</div> " to run a cell, the output will be shown in the interactive window'
                    )
                }}
            />
        );
    }

    private renderFolderDescription(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph list"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.folderDesc',
                        '- Open a <div class="link" role="button" onclick={0}>Folder</div><br /> - Open a <div class="link" role="button" onclick={1}>Workspace</div>'
                    ).format('openFolder()', 'openWorkspace()')
                }}
            />
        );
    }

    private renderReleaseNotesLink(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.releaseNotes',
                        'Take a look at our <a class="link" href={0}>Release Notes</a> to learn more about the latest features'
                    ).format('https://aka.ms/AA8dxtb')
                }}
            />
        );
    }

    private renderReleaseNotes(): JSX.Element {
        const notes: JSX.Element[] = [];
        this.releaseNotes.notes.forEach((rel, index) => {
            notes.push(<li key={index}>{rel}</li>);
        });
        return <ul className="list">{notes}</ul>;
    }

    private renderTutorialAndDoc(): JSX.Element {
        // tslint:disable: react-no-dangerous-html
        return (
            <div
                className="paragraph"
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.tutorialAndDoc',
                        'Explore more features in our <a class="link" href={0}>Tutorials</a> or check <a class="link" href={1}>Documentation</a> for tips and troubleshooting.'
                    ).format('https://aka.ms/AA8dqti', 'https://aka.ms/AA8dxwy')
                }}
            />
        );
    }

    private openBlankNotebook = () => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankNotebook);
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
        this.releaseNotes.showAgainSetting = !this.releaseNotes.showAgainSetting;
        this.postOffice.sendMessage<IStartPageMapping>(
            StartPageMessages.UpdateSettings,
            this.releaseNotes.showAgainSetting
        );
    };
}
