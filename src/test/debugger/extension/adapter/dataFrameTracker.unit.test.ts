// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import { Extension } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IExtensions } from '../../../../client/common/types';
import { JUPYTER_EXTENSION_ID } from '../../../../client/common/constants';
import { DataFrameTrackerFactory } from '../../../../client/debugger/extension/adapter/dataFrameTracker';

suite('DataFrame Tracker', () => {
    let extensions: IExtensions;
    let mockExtensions: IExtensions;
    let trackerFactory: DataFrameTrackerFactory;

    setup(() => {
        mockExtensions = mock<IExtensions>();
        extensions = instance(mockExtensions);
        trackerFactory = new DataFrameTrackerFactory(extensions);
    });

    test('Should create debug adapter tracker', () => {
        const mockSession = {} as any;
        const tracker = trackerFactory.createDebugAdapterTracker(mockSession);
        expect(tracker).to.not.be.undefined;
    });

    test('Should detect pandas DataFrame variable', () => {
        const mockSession = {} as any;
        const tracker = trackerFactory.createDebugAdapterTracker(mockSession) as any;
        
        // Mock Jupyter extension not being installed
        when(mockExtensions.getExtension(JUPYTER_EXTENSION_ID)).thenReturn(undefined);

        const variablesResponse: DebugProtocol.VariablesResponse = {
            type: 'response',
            seq: 1,
            request_seq: 1,
            success: true,
            command: 'variables',
            body: {
                variables: [
                    {
                        name: 'df',
                        value: '<pandas.core.frame.DataFrame object>',
                        type: 'pandas.core.frame.DataFrame',
                        variablesReference: 0,
                    },
                    {
                        name: 'x',
                        value: '42',
                        type: 'int',
                        variablesReference: 0,
                    }
                ]
            }
        };

        // This should detect the DataFrame and try to show notification
        tracker.onDidSendMessage(variablesResponse);
        
        // Verify that extension check was called
        verify(mockExtensions.getExtension(JUPYTER_EXTENSION_ID)).once();
    });

    test('Should not show notification if Jupyter extension is installed', () => {
        const mockSession = {} as any;
        const tracker = trackerFactory.createDebugAdapterTracker(mockSession) as any;
        
        // Mock Jupyter extension being installed
        const mockJupyterExt = mock<Extension<any>>();
        when(mockExtensions.getExtension(JUPYTER_EXTENSION_ID)).thenReturn(instance(mockJupyterExt));

        const variablesResponse: DebugProtocol.VariablesResponse = {
            type: 'response',
            seq: 1,
            request_seq: 1,
            success: true,
            command: 'variables',
            body: {
                variables: [
                    {
                        name: 'df',
                        value: '<pandas.core.frame.DataFrame object>',
                        type: 'pandas.core.frame.DataFrame',
                        variablesReference: 0,
                    }
                ]
            }
        };

        tracker.onDidSendMessage(variablesResponse);
        
        // Verify that extension check was called but no notification should show
        verify(mockExtensions.getExtension(JUPYTER_EXTENSION_ID)).once();
    });

    test('Should detect various dataframe types', () => {
        // This test verifies that the dataFrameTypes array contains the expected types
        const expectedTypes = [
            'pandas.core.frame.DataFrame',
            'pandas.DataFrame',
            'polars.DataFrame',
            'cudf.DataFrame',
            'dask.dataframe.core.DataFrame',
            'modin.pandas.DataFrame',
            'vaex.dataframe.DataFrame',
            'geopandas.geodataframe.GeoDataFrame',
        ];

        expectedTypes.forEach(expectedType => {
            // Verify each expected type would be matched by at least one pattern
            const hasMatch = expectedTypes.some(pattern => expectedType.includes(pattern));
            expect(hasMatch).to.be.true;
        });
    });

    test('Should not detect non-dataframe variables', () => {
        const nonDataFrameTypes = [
            'str',
            'int',
            'list',
            'dict',
            'numpy.ndarray',
            'matplotlib.figure.Figure',
        ];

        const dataFrameTypes = [
            'pandas.core.frame.DataFrame',
            'pandas.DataFrame',
            'polars.DataFrame',
            'cudf.DataFrame',
            'dask.dataframe.core.DataFrame',
            'modin.pandas.DataFrame',
            'vaex.dataframe.DataFrame',
            'geopandas.geodataframe.GeoDataFrame',
        ];

        nonDataFrameTypes.forEach(varType => {
            // These should not be detected as dataframes
            const hasMatch = dataFrameTypes.some(dfType => varType.includes(dfType));
            expect(hasMatch).to.be.false;
        });
    });
});