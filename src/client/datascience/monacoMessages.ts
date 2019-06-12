// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

export interface IGetMonacoThemeResponse {
    theme: monacoEditor.editor.IStandaloneThemeData;
}
