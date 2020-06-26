import { QuickPickItem, QuickInputButton } from "vscode";


// Typings for the code in the python extension
export interface IPythonExtensionApi {
    datascience: {
        /**
         * Launches Data Viewer component.
         * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
         * @param {string} title Data Viewer title
         */
        showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
        /**
         * Registers a remote server provider component that's used to pick remote jupyter server URIs
         * @param serverProvider object called back when picking jupyter server URI
         */
        registerRemoteServerProvider(serverProvider: IJupyterUriQuickPicker): void;
    };
}

export interface IDataFrameInfo {
    columns?: { key: string; type: ColumnType }[];
    indexColumn?: string;
    rowCount?: number;
}

export interface IDataViewerDataProvider {
    dispose(): void;
    getDataFrameInfo(): Promise<IDataFrameInfo>;
    getAllRows(): Promise<IRowsResponse>;
    getRows(start: number, end: number): Promise<IRowsResponse>;
}

export enum ColumnType {
    String = 'string',
    Number = 'number',
    Bool = 'bool'
}

// tslint:disable-next-line: no-any
export type IRowsResponse = any[];

export interface IJupyterServerUri {
    baseUrl: string;
    token: string;
    // tslint:disable-next-line: no-any
    authorizationHeader: any; // JSON object for authorization header.
}

export type JupyterServerUriHandle = string;

export interface IJupyterUriQuickPicker {
    id: string; // Should be a unique string (like a guid)
    getQuickPickEntryItems(): QuickPickItem[];
    handleNextSteps(
        item: QuickPickItem,
        completion: (uriHandle: JupyterServerUriHandle | undefined) => void,
        input: IMultiStepInput<{}>,
        state: {}
    ): Promise<InputStep<{}> | void>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}

export type InputStep<T extends any> = (input: IMultiStepInput<T>, state: T) => Promise<InputStep<T> | void>;

export interface IQuickPickParameters<T extends QuickPickItem> {
    title?: string;
    step?: number;
    totalSteps?: number;
    canGoBack?: boolean;
    items: T[];
    activeItem?: T;
    placeholder: string;
    buttons?: QuickInputButton[];
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
    acceptFilterBoxTextAsSelection?: boolean;
    shouldResume?(): Promise<boolean>;
}

// tslint:disable-next-line: interface-name
export interface InputBoxParameters {
    title: string;
    password?: boolean;
    step?: number;
    totalSteps?: number;
    value: string;
    prompt: string;
    buttons?: QuickInputButton[];
    validate(value: string): Promise<string | undefined>;
    shouldResume?(): Promise<boolean>;
}

type MultiStepInputQuickPicResponseType<T, P> = T | (P extends { buttons: (infer I)[] } ? I : never);
type MultiStepInputInputBoxResponseType<P> = string | (P extends { buttons: (infer I)[] } ? I : never);
export interface IMultiStepInput<S> {
    run(start: InputStep<S>, state: S): Promise<void>;
    showQuickPick<T extends QuickPickItem, P extends IQuickPickParameters<T>>({
        title,
        step,
        totalSteps,
        items,
        activeItem,
        placeholder,
        buttons,
        shouldResume
    }: P): Promise<MultiStepInputQuickPicResponseType<T, P>>;
    showInputBox<P extends InputBoxParameters>({
        title,
        step,
        totalSteps,
        value,
        prompt,
        validate,
        buttons,
        shouldResume
    }: P): Promise<MultiStepInputInputBoxResponseType<P>>;
}
