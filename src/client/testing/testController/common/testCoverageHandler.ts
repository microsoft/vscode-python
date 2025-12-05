// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri, TestCoverageCount, FileCoverage, FileCoverageDetail, StatementCoverage, Range } from 'vscode';
import { CoveragePayload, FileCoverageMetrics } from './types';

/**
 * Stateless handler for processing coverage payloads and creating coverage objects.
 * This handler is shared across all workspaces and contains no instance state.
 */
export class TestCoverageHandler {
    /**
     * Process coverage payload
     * Pure function - returns coverage data without storing it
     */
    public processCoverage(payload: CoveragePayload, runInstance: TestRun): Map<string, FileCoverageDetail[]> {
        const detailedCoverageMap = new Map<string, FileCoverageDetail[]>();

        if (payload.result === undefined) {
            return detailedCoverageMap;
        }

        for (const [key, value] of Object.entries(payload.result)) {
            const fileNameStr = key;
            const fileCoverageMetrics: FileCoverageMetrics = value;

            // Create FileCoverage object and add to run instance
            const fileCoverage = this.createFileCoverage(Uri.file(fileNameStr), fileCoverageMetrics);
            runInstance.addCoverage(fileCoverage);

            // Create detailed coverage array for this file
            const detailedCoverage = this.createDetailedCoverage(
                fileCoverageMetrics.lines_covered ?? [],
                fileCoverageMetrics.lines_missed ?? [],
            );
            detailedCoverageMap.set(Uri.file(fileNameStr).fsPath, detailedCoverage);
        }

        return detailedCoverageMap;
    }

    /**
     * Create FileCoverage object from metrics
     */
    private createFileCoverage(uri: Uri, metrics: FileCoverageMetrics): FileCoverage {
        const linesCovered = metrics.lines_covered ?? [];
        const linesMissed = metrics.lines_missed ?? [];
        const executedBranches = metrics.executed_branches;
        const totalBranches = metrics.total_branches;

        const lineCoverageCount = new TestCoverageCount(linesCovered.length, linesCovered.length + linesMissed.length);

        if (totalBranches === -1) {
            // branch coverage was not enabled and should not be displayed
            return new FileCoverage(uri, lineCoverageCount);
        } else {
            const branchCoverageCount = new TestCoverageCount(executedBranches, totalBranches);
            return new FileCoverage(uri, lineCoverageCount, branchCoverageCount);
        }
    }

    /**
     * Create detailed coverage array for a file
     * Only line coverage on detailed, not branch coverage
     */
    private createDetailedCoverage(linesCovered: number[], linesMissed: number[]): FileCoverageDetail[] {
        const detailedCoverageArray: FileCoverageDetail[] = [];

        // Add covered lines
        for (const line of linesCovered) {
            // line is 1-indexed, so we need to subtract 1 to get the 0-indexed line number
            // true value means line is covered
            const statementCoverage = new StatementCoverage(
                true,
                new Range(line - 1, 0, line - 1, Number.MAX_SAFE_INTEGER),
            );
            detailedCoverageArray.push(statementCoverage);
        }

        // Add missed lines
        for (const line of linesMissed) {
            // line is 1-indexed, so we need to subtract 1 to get the 0-indexed line number
            // false value means line is NOT covered
            const statementCoverage = new StatementCoverage(
                false,
                new Range(line - 1, 0, line - 1, Number.MAX_SAFE_INTEGER),
            );
            detailedCoverageArray.push(statementCoverage);
        }

        return detailedCoverageArray;
    }
}
