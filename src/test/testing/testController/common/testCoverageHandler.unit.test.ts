// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri, FileCoverage } from 'vscode';
import * as typemoq from 'typemoq';
import * as assert from 'assert';
import { TestCoverageHandler } from '../../../../client/testing/testController/common/testCoverageHandler';
import { CoveragePayload } from '../../../../client/testing/testController/common/types';

suite('TestCoverageHandler', () => {
    let coverageHandler: TestCoverageHandler;
    let runInstanceMock: typemoq.IMock<TestRun>;

    setup(() => {
        coverageHandler = new TestCoverageHandler();
        runInstanceMock = typemoq.Mock.ofType<TestRun>();
    });

    suite('processCoverage', () => {
        test('should return empty map for undefined result', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: undefined,
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.strictEqual(result.size, 0);
            runInstanceMock.verify((r) => r.addCoverage(typemoq.It.isAny()), typemoq.Times.never());
        });

        test('should create FileCoverage for each file', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file1.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [4, 5],
                        executed_branches: 5,
                        total_branches: 10,
                    },
                    '/path/to/file2.py': {
                        lines_covered: [1, 2],
                        lines_missed: [3],
                        executed_branches: 2,
                        total_branches: 4,
                    },
                },
                error: '',
            };

            coverageHandler.processCoverage(payload, runInstanceMock.object);

            runInstanceMock.verify((r) => r.addCoverage(typemoq.It.isAny()), typemoq.Times.exactly(2));
        });

        test('should call runInstance.addCoverage with correct FileCoverage', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [4, 5],
                        executed_branches: 5,
                        total_branches: 10,
                    },
                },
                error: '',
            };

            let capturedCoverage: FileCoverage | undefined;
            runInstanceMock
                .setup((r) => r.addCoverage(typemoq.It.isAny()))
                .callback((coverage: FileCoverage) => {
                    capturedCoverage = coverage;
                });

            coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.ok(capturedCoverage);
            assert.strictEqual(capturedCoverage!.uri.fsPath, '/path/to/file.py');
        });

        test('should return detailed coverage map with correct keys', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file1.py': {
                        lines_covered: [1, 2],
                        lines_missed: [3],
                        executed_branches: 2,
                        total_branches: 4,
                    },
                    '/path/to/file2.py': {
                        lines_covered: [5, 6, 7],
                        lines_missed: [],
                        executed_branches: 3,
                        total_branches: 3,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.strictEqual(result.size, 2);
            assert.ok(result.has(Uri.file('/path/to/file1.py').fsPath));
            assert.ok(result.has(Uri.file('/path/to/file2.py').fsPath));
        });

        test('should handle empty coverage data', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {},
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.strictEqual(result.size, 0);
        });

        test('should handle file with no covered lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [],
                        lines_missed: [1, 2, 3],
                        executed_branches: 0,
                        total_branches: 5,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 3); // Only missed lines
        });

        test('should handle file with no missed lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [],
                        executed_branches: 5,
                        total_branches: 5,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 3); // Only covered lines
        });

        test('should handle undefined lines_covered', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: undefined as any,
                        lines_missed: [1, 2],
                        executed_branches: 0,
                        total_branches: 2,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 2); // Only missed lines
        });

        test('should handle undefined lines_missed', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2],
                        lines_missed: undefined as any,
                        executed_branches: 2,
                        total_branches: 2,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 2); // Only covered lines
        });
    });

    suite('createFileCoverage', () => {
        test('should handle line coverage only when totalBranches is -1', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [4, 5],
                        executed_branches: 0,
                        total_branches: -1, // Branch coverage disabled
                    },
                },
                error: '',
            };

            let capturedCoverage: FileCoverage | undefined;
            runInstanceMock
                .setup((r) => r.addCoverage(typemoq.It.isAny()))
                .callback((coverage: FileCoverage) => {
                    capturedCoverage = coverage;
                });

            coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.ok(capturedCoverage);
            // Branch coverage should not be included
            assert.strictEqual((capturedCoverage as any).branchCoverage, undefined);
        });

        test('should include branch coverage when available', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [4],
                        executed_branches: 7,
                        total_branches: 10,
                    },
                },
                error: '',
            };

            let capturedCoverage: FileCoverage | undefined;
            runInstanceMock
                .setup((r) => r.addCoverage(typemoq.It.isAny()))
                .callback((coverage: FileCoverage) => {
                    capturedCoverage = coverage;
                });

            coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.ok(capturedCoverage);
            // Should have branch coverage
            assert.ok((capturedCoverage as any).branchCoverage);
        });

        test('should calculate line coverage counts correctly', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3, 4, 5],
                        lines_missed: [6, 7],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            let capturedCoverage: FileCoverage | undefined;
            runInstanceMock
                .setup((r) => r.addCoverage(typemoq.It.isAny()))
                .callback((coverage: FileCoverage) => {
                    capturedCoverage = coverage;
                });

            coverageHandler.processCoverage(payload, runInstanceMock.object);

            assert.ok(capturedCoverage);
            // 5 covered out of 7 total (5 covered + 2 missed)
            assert.strictEqual((capturedCoverage as any).statementCoverage.covered, 5);
            assert.strictEqual((capturedCoverage as any).statementCoverage.total, 7);
        });
    });

    suite('createDetailedCoverage', () => {
        test('should create StatementCoverage for covered lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 2, 3],
                        lines_missed: [],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 3);

            // All should be covered (true)
            detailedCoverage!.forEach((coverage) => {
                assert.strictEqual((coverage as any).executed, true);
            });
        });

        test('should create StatementCoverage for missed lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [],
                        lines_missed: [1, 2, 3],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 3);

            // All should be NOT covered (false)
            detailedCoverage!.forEach((coverage) => {
                assert.strictEqual((coverage as any).executed, false);
            });
        });

        test('should convert 1-indexed to 0-indexed line numbers for covered lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 5, 10],
                        lines_missed: [],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);

            // Line 1 should map to range starting at line 0
            assert.strictEqual((detailedCoverage![0] as any).location.start.line, 0);
            // Line 5 should map to range starting at line 4
            assert.strictEqual((detailedCoverage![1] as any).location.start.line, 4);
            // Line 10 should map to range starting at line 9
            assert.strictEqual((detailedCoverage![2] as any).location.start.line, 9);
        });

        test('should convert 1-indexed to 0-indexed line numbers for missed lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [],
                        lines_missed: [3, 7, 12],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);

            // Line 3 should map to range starting at line 2
            assert.strictEqual((detailedCoverage![0] as any).location.start.line, 2);
            // Line 7 should map to range starting at line 6
            assert.strictEqual((detailedCoverage![1] as any).location.start.line, 6);
            // Line 12 should map to range starting at line 11
            assert.strictEqual((detailedCoverage![2] as any).location.start.line, 11);
        });

        test('should handle large line numbers', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1000, 5000, 10000],
                        lines_missed: [],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 3);

            // Verify conversion is correct for large numbers
            assert.strictEqual((detailedCoverage![0] as any).location.start.line, 999);
            assert.strictEqual((detailedCoverage![1] as any).location.start.line, 4999);
            assert.strictEqual((detailedCoverage![2] as any).location.start.line, 9999);
        });

        test('should create detailed coverage with both covered and missed lines', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1, 3, 5],
                        lines_missed: [2, 4, 6],
                        executed_branches: 3,
                        total_branches: 6,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);
            assert.strictEqual(detailedCoverage!.length, 6); // 3 covered + 3 missed

            // Count covered vs not covered
            const covered = detailedCoverage!.filter((c) => (c as any).executed === true);
            const notCovered = detailedCoverage!.filter((c) => (c as any).executed === false);

            assert.strictEqual(covered.length, 3);
            assert.strictEqual(notCovered.length, 3);
        });

        test('should set range to cover entire line', () => {
            const payload: CoveragePayload = {
                coverage: true,
                cwd: '/foo/bar',
                result: {
                    '/path/to/file.py': {
                        lines_covered: [1],
                        lines_missed: [],
                        executed_branches: 0,
                        total_branches: -1,
                    },
                },
                error: '',
            };

            const result = coverageHandler.processCoverage(payload, runInstanceMock.object);

            const detailedCoverage = result.get(Uri.file('/path/to/file.py').fsPath);
            assert.ok(detailedCoverage);

            const coverage = detailedCoverage![0] as any;
            // Start at column 0
            assert.strictEqual(coverage.location.start.character, 0);
            // End at max safe integer (entire line)
            assert.strictEqual(coverage.location.end.character, Number.MAX_SAFE_INTEGER);
        });
    });
});
