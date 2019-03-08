// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// **Hint for VS Code users:
//    Press `ctrl+k, ctrl+0` to collapse all in this file...

import { TestFile, Tests } from '../../../client/unittests/common/types';

type PytestTestScenario = {
    json: string;
    expectedResult: Tests;
    expectedTestFiles: TestFile[];
    scenarioDescription: string;
};

export const pytestScenario: PytestTestScenario[] = [];

// note: JSON stringify was used to obtain these results, but we have to modify them further to change '\\' to expected '\\\\'.
const json_testFiles_singleTestFileAtRoot = '[{"functions":[],"suites":[{"name":"TestSingleTestAtRoot","nameToRun":"test_single_at_root.py::TestSingleTestAtRoot","functions":[{"name":"test_fail","nameToRun":"test_single_at_root.py::TestSingleTestAtRoot::test_fail","time":0},{"name":"test_success","nameToRun":"test_single_at_root.py::TestSingleTestAtRoot::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_single_at_root.TestSingleTestAtRoot","time":0},{"name":"TestSingleAtRootSuite","nameToRun":"test_single_at_root.py::TestSingleAtRootSuite","functions":[{"name":"test_suite_fail","nameToRun":"test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail","time":0},{"name":"test_suite_success","nameToRun":"test_single_at_root.py::TestSingleAtRootSuite::test_suite_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_single_at_root.TestSingleAtRootSuite","time":0}],"name":"test_single_at_root.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_at_root\\\\test_single_at_root.py","nameToRun":"test_single_at_root.py","xmlName":"test_single_at_root","time":0}]';
const json_testFiles_singleTestFileSubRoot = '[{"functions":[],"suites":[{"name":"TestSingleTestSubRoot","nameToRun":"test/test_single_sub_root.py::TestSingleTestSubRoot","functions":[{"name":"test_fail","nameToRun":"test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail","time":0},{"name":"test_success","nameToRun":"test/test_single_sub_root.py::TestSingleTestSubRoot::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test.test_single_sub_root.TestSingleTestSubRoot","time":0},{"name":"TestSingleSubRootSuite","nameToRun":"test/test_single_sub_root.py::TestSingleSubRootSuite","functions":[{"name":"test_suite_fail","nameToRun":"test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail","time":0},{"name":"test_suite_success","nameToRun":"test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test.test_single_sub_root.TestSingleSubRootSuite","time":0}],"name":"test/test_single_sub_root.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_sub_root\\\\test\\\\test_single_sub_root.py","nameToRun":"test/test_single_sub_root.py","xmlName":"test.test_single_sub_root","time":0}]';
const json_testFiles_multiTestFileAtRoot = '[{"functions":[],"suites":[{"name":"TestMultipleTestFilesAtRootOne","nameToRun":"test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne","functions":[{"name":"test_fail","nameToRun":"test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail","time":0},{"name":"test_success","nameToRun":"test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_multiple_at_root_1.TestMultipleTestFilesAtRootOne","time":0}],"name":"test_multiple_at_root_1.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root\\\\test_multiple_at_root_1.py","nameToRun":"test_multiple_at_root_1.py","xmlName":"test_multiple_at_root_1","time":0},{"functions":[],"suites":[{"name":"TestMultipleTestFilesAtRootTwo","nameToRun":"test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo","functions":[{"name":"test_fail","nameToRun":"test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail","time":0},{"name":"test_success","nameToRun":"test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo","time":0}],"name":"test_multiple_at_root_2.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root\\\\test_multiple_at_root_2.py","nameToRun":"test_multiple_at_root_2.py","xmlName":"test_multiple_at_root_2","time":0},{"functions":[],"suites":[{"name":"TestMultipleTestFilesAtRootThree","nameToRun":"test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree","functions":[{"name":"test_fail","nameToRun":"test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail","time":0},{"name":"test_success","nameToRun":"test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_multiple_at_root_3.TestMultipleTestFilesAtRootThree","time":0}],"name":"test_multiple_at_root_3.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root\\\\test_multiple_at_root_3.py","nameToRun":"test_multiple_at_root_3.py","xmlName":"test_multiple_at_root_3","time":0}]';
const json_testFiles_multiTestFilesSubRoot = '[{"functions":[],"suites":[{"name":"TestMultipleTestSubRootOne","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne","functions":[{"name":"test_fail","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail","time":0},{"name":"test_success","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne","time":0},{"name":"TestMultipleSubRootSuiteOne","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne","functions":[{"name":"test_suite_fail","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail","time":0},{"name":"test_suite_success","nameToRun":"test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne","time":0}],"name":"test_one/test_multiple_sub_root_1.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root\\\\test_one\\\\test_multiple_sub_root_1.py","nameToRun":"test_one/test_multiple_sub_root_1.py","xmlName":"test_one.test_multiple_sub_root_1","time":0},{"functions":[],"suites":[{"name":"TestMultipleTestSubRootThree","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree","functions":[{"name":"test_fail","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail","time":0},{"name":"test_success","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree","time":0},{"name":"TestMultipleSubRootSuiteThree","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree","functions":[{"name":"test_suite_fail","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail","time":0},{"name":"test_suite_success","nameToRun":"test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree","time":0}],"name":"test_three/test_multiple_sub_root_3.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root\\\\test_three\\\\test_multiple_sub_root_3.py","nameToRun":"test_three/test_multiple_sub_root_3.py","xmlName":"test_three.test_multiple_sub_root_3","time":0},{"functions":[],"suites":[{"name":"TestMultipleTestSubRootTwo","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo","functions":[{"name":"test_fail","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail","time":0},{"name":"test_success","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo","time":0},{"name":"TestMultipleSubRootSuiteTwo","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo","functions":[{"name":"test_suite_fail","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail","time":0},{"name":"test_suite_success","nameToRun":"test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo","time":0}],"name":"test_two/test_multiple_sub_root_2.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root\\\\test_two\\\\test_multiple_sub_root_2.py","nameToRun":"test_two/test_multiple_sub_root_2.py","xmlName":"test_two.test_multiple_sub_root_2","time":0}]';
const json_testFiles_deepTestFile = '[{"functions":[],"suites":[{"name":"TestDeepness","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness","functions":[{"name":"test_deep","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep","time":0},{"name":"test_deep_fail","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness","time":0},{"name":"TestSuiteDeepness","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness","functions":[{"name":"test_suite_deep","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep","time":0},{"name":"test_suite_deep_fail","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail","time":0}],"suites":[],"isUnitTest":true,"isInstance":false,"xmlName":"src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness","time":0}],"name":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py","fullPath":"C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\deep_test_file\\\\src\\\\sub1\\\\sub2\\\\sub3\\\\sub4\\\\sub5\\\\sub6\\\\test_deepness.py","nameToRun":"src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py","xmlName":"src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness","time":0}]';

export const json_singleTestAtRoot = '[{"id": "test_single_at_root.py::TestSingleTestAtRoot::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_at_root", "relfile": ".\\\\test_single_at_root.py", "lineno": 7, "testfunc": "TestSingleTestAtRoot.test_fail", "subtest": null, "markers": null}, {"id": "test_single_at_root.py::TestSingleTestAtRoot::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_at_root", "relfile": ".\\\\test_single_at_root.py", "lineno": 4, "testfunc": "TestSingleTestAtRoot.test_success", "subtest": null, "markers": null}, {"id": "test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail", "name": "test_suite_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_at_root", "relfile": ".\\\\test_single_at_root.py", "lineno": 15, "testfunc": "TestSingleAtRootSuite.test_suite_fail", "subtest": null, "markers": null}, {"id": "test_single_at_root.py::TestSingleAtRootSuite::test_suite_success", "name": "test_suite_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_at_root", "relfile": ".\\\\test_single_at_root.py", "lineno": 12, "testfunc": "TestSingleAtRootSuite.test_suite_success", "subtest": null, "markers": null}]';
export const json_singleTestSubRoot = '[{"id": "test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_sub_root", "relfile": "test\\\\test_single_sub_root.py", "lineno": 7, "testfunc": "TestSingleTestSubRoot.test_fail", "subtest": null, "markers": null}, {"id": "test/test_single_sub_root.py::TestSingleTestSubRoot::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_sub_root", "relfile": "test\\\\test_single_sub_root.py", "lineno": 4, "testfunc": "TestSingleTestSubRoot.test_success", "subtest": null, "markers": null}, {"id": "test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail", "name": "test_suite_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_sub_root", "relfile": "test\\\\test_single_sub_root.py", "lineno": 14, "testfunc": "TestSingleSubRootSuite.test_suite_fail", "subtest": null, "markers": null}, {"id": "test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success", "name": "test_suite_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\single_test_file_sub_root", "relfile": "test\\\\test_single_sub_root.py", "lineno": 11, "testfunc": "TestSingleSubRootSuite.test_suite_success", "subtest": null, "markers": null}]';
export const json_multiTestsAtRoot = '[{"id": "test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_1.py", "lineno": 7, "testfunc": "TestMultipleTestFilesAtRootOne.test_fail", "subtest": null, "markers": null}, {"id": "test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_1.py", "lineno": 4, "testfunc": "TestMultipleTestFilesAtRootOne.test_success", "subtest": null, "markers": null}, {"id": "test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_2.py", "lineno": 7, "testfunc": "TestMultipleTestFilesAtRootTwo.test_fail", "subtest": null, "markers": null}, {"id": "test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_2.py", "lineno": 4, "testfunc": "TestMultipleTestFilesAtRootTwo.test_success", "subtest": null, "markers": null}, {"id": "test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_3.py", "lineno": 7, "testfunc": "TestMultipleTestFilesAtRootThree.test_fail", "subtest": null, "markers": null}, {"id": "test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_at_root", "relfile": ".\\\\test_multiple_at_root_3.py", "lineno": 4, "testfunc": "TestMultipleTestFilesAtRootThree.test_success", "subtest": null, "markers": null}]';
export const json_multiTestsSubRoot = '[{"id": "test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_one\\\\test_multiple_sub_root_1.py", "lineno": 7, "testfunc": "TestMultipleTestSubRootOne.test_fail", "subtest": null, "markers": null}, {"id": "test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_one\\\\test_multiple_sub_root_1.py", "lineno": 4, "testfunc": "TestMultipleTestSubRootOne.test_success", "subtest": null, "markers": null}, {"id": "test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail", "name": "test_suite_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_one\\\\test_multiple_sub_root_1.py", "lineno": 14, "testfunc": "TestMultipleSubRootSuiteOne.test_suite_fail", "subtest": null, "markers": null}, {"id": "test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success", "name": "test_suite_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_one\\\\test_multiple_sub_root_1.py", "lineno": 11, "testfunc": "TestMultipleSubRootSuiteOne.test_suite_success", "subtest": null, "markers": null}, {"id": "test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_three\\\\test_multiple_sub_root_3.py", "lineno": 7, "testfunc": "TestMultipleTestSubRootThree.test_fail", "subtest": null, "markers": null}, {"id": "test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_three\\\\test_multiple_sub_root_3.py", "lineno": 4, "testfunc": "TestMultipleTestSubRootThree.test_success", "subtest": null, "markers": null}, {"id": "test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail", "name": "test_suite_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_three\\\\test_multiple_sub_root_3.py", "lineno": 14, "testfunc": "TestMultipleSubRootSuiteThree.test_suite_fail", "subtest": null, "markers": null}, {"id": "test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success", "name": "test_suite_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_three\\\\test_multiple_sub_root_3.py", "lineno": 11, "testfunc": "TestMultipleSubRootSuiteThree.test_suite_success", "subtest": null, "markers": null}, {"id": "test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail", "name": "test_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_two\\\\test_multiple_sub_root_2.py", "lineno": 7, "testfunc": "TestMultipleTestSubRootTwo.test_fail", "subtest": null, "markers": null}, {"id": "test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success", "name": "test_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_two\\\\test_multiple_sub_root_2.py", "lineno": 4, "testfunc": "TestMultipleTestSubRootTwo.test_success", "subtest": null, "markers": null}, {"id": "test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail", "name": "test_suite_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_two\\\\test_multiple_sub_root_2.py", "lineno": 14, "testfunc": "TestMultipleSubRootSuiteTwo.test_suite_fail", "subtest": null, "markers": null}, {"id": "test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success", "name": "test_suite_success", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\multiple_test_files_sub_root", "relfile": "test_two\\\\test_multiple_sub_root_2.py", "lineno": 11, "testfunc": "TestMultipleSubRootSuiteTwo.test_suite_success", "subtest": null, "markers": null}]';
export const json_deepFolderTest = '[{"id": "src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep", "name": "test_deep", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\deep_test_file", "relfile": "src\\\\sub1\\\\sub2\\\\sub3\\\\sub4\\\\sub5\\\\sub6\\\\test_deepness.py", "lineno": 4, "testfunc": "TestDeepness.test_deep", "subtest": null, "markers": null}, {"id": "src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail", "name": "test_deep_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\deep_test_file", "relfile": "src\\\\sub1\\\\sub2\\\\sub3\\\\sub4\\\\sub5\\\\sub6\\\\test_deepness.py", "lineno": 7, "testfunc": "TestDeepness.test_deep_fail", "subtest": null, "markers": null}, {"id": "src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep", "name": "test_suite_deep", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\deep_test_file", "relfile": "src\\\\sub1\\\\sub2\\\\sub3\\\\sub4\\\\sub5\\\\sub6\\\\test_deepness.py", "lineno": 11, "testfunc": "TestSuiteDeepness.test_suite_deep", "subtest": null, "markers": null}, {"id": "src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail", "name": "test_suite_deep_fail", "testroot": "C:\\\\dev\\\\github\\\\d3r3kk\\\\test\\\\test_scenario\\\\deep_test_file", "relfile": "src\\\\sub1\\\\sub2\\\\sub3\\\\sub4\\\\sub5\\\\sub6\\\\test_deepness.py", "lineno": 14, "testfunc": "TestSuiteDeepness.test_suite_deep_fail", "subtest": null, "markers": null}]';

export const expected_deepFolderTest: Tests = {
    testFiles: [
        {
            functions: [], suites: [
                {
                    name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                        {
                            name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                        },
                        {
                            name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                },
                {
                    name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                        {
                            name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                        },
                        {
                            name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                }
            ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
        }
    ], testFunctions: [
        {
            testFunction: {
                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, parentTestSuite: {
                name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                    {
                        name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                    },
                    {
                        name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, parentTestSuite: {
                name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                    {
                        name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                    },
                    {
                        name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, parentTestSuite: {
                name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                    {
                        name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                    },
                    {
                        name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, parentTestSuite: {
                name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                    {
                        name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                    },
                    {
                        name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
            }
        }
    ], testSuites: [
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, testSuite: {
                name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                    {
                        name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                    },
                    {
                        name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                            {
                                name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                            },
                            {
                                name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                    },
                    {
                        name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                            {
                                name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                            },
                            {
                                name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                    }
                ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
            }, testSuite: {
                name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                    {
                        name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                    },
                    {
                        name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
            }, xmlClassName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness'
        }
    ], testFolders: [
        {
            name: 'src', testFiles: [], folders: [
                {
                    name: 'src\\sub1', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2', testFiles: [], folders: [
                                {
                                    name: 'src\\sub1\\sub2\\sub3', testFiles: [], folders: [
                                        {
                                            name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                                                {
                                                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                                                        {
                                                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                                                {
                                                                    functions: [], suites: [
                                                                        {
                                                                            name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                                                {
                                                                                    name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                                                },
                                                                                {
                                                                                    name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                                                }
                                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                                                        },
                                                                        {
                                                                            name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                                                {
                                                                                    name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                                                },
                                                                                {
                                                                                    name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                                                }
                                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                                                        }
                                                                    ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                                                }
                                                            ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                                                        }
                                                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                                                }
                                            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
                                        }
                                    ], nameToRun: 'src\\sub1\\sub2\\sub3', time: 0
                                }
                            ], nameToRun: 'src\\sub1\\sub2', time: 0
                        }
                    ], nameToRun: 'src\\sub1', time: 0
                }
            ], nameToRun: 'src', time: 0
        },
        {
            name: 'src\\sub1', testFiles: [], folders: [
                {
                    name: 'src\\sub1\\sub2', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2\\sub3', testFiles: [], folders: [
                                {
                                    name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                                        {
                                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                                                {
                                                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                                        {
                                                            functions: [], suites: [
                                                                {
                                                                    name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                                        {
                                                                            name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                                        },
                                                                        {
                                                                            name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                                        }
                                                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                                                },
                                                                {
                                                                    name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                                        {
                                                                            name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                                        },
                                                                        {
                                                                            name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                                        }
                                                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                                                }
                                                            ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                                        }
                                                    ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                                                }
                                            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                                        }
                                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
                                }
                            ], nameToRun: 'src\\sub1\\sub2\\sub3', time: 0
                        }
                    ], nameToRun: 'src\\sub1\\sub2', time: 0
                }
            ], nameToRun: 'src\\sub1', time: 0
        },
        {
            name: 'src\\sub1\\sub2', testFiles: [], folders: [
                {
                    name: 'src\\sub1\\sub2\\sub3', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                                {
                                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                                        {
                                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                                {
                                                    functions: [], suites: [
                                                        {
                                                            name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                                {
                                                                    name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                                },
                                                                {
                                                                    name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                                }
                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                                        },
                                                        {
                                                            name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                                {
                                                                    name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                                },
                                                                {
                                                                    name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                                }
                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                                        }
                                                    ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                                }
                                            ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                                        }
                                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                                }
                            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
                        }
                    ], nameToRun: 'src\\sub1\\sub2\\sub3', time: 0
                }
            ], nameToRun: 'src\\sub1\\sub2', time: 0
        },
        {
            name: 'src\\sub1\\sub2\\sub3', testFiles: [], folders: [
                {
                    name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                                {
                                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                        {
                                            functions: [], suites: [
                                                {
                                                    name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                        {
                                                            name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                        },
                                                        {
                                                            name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                        }
                                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                                },
                                                {
                                                    name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                        {
                                                            name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                        },
                                                        {
                                                            name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                        }
                                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                                }
                                            ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                        }
                                    ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                                }
                            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                        }
                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
                }
            ], nameToRun: 'src\\sub1\\sub2\\sub3', time: 0
        },
        {
            name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                {
                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                {
                                    functions: [], suites: [
                                        {
                                            name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                {
                                                    name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                },
                                                {
                                                    name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                }
                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                        },
                                        {
                                            name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                {
                                                    name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                },
                                                {
                                                    name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                }
                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                        }
                                    ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                }
                            ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                        }
                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                }
            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
        },
        {
            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                {
                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                        {
                            functions: [], suites: [
                                {
                                    name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                        {
                                            name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                        },
                                        {
                                            name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                        }
                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                },
                                {
                                    name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                        {
                                            name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                        },
                                        {
                                            name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                        }
                                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                }
                            ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                        }
                    ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                }
            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
        },
        {
            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                {
                                    name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                },
                                {
                                    name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                        },
                        {
                            name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                {
                                    name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                },
                                {
                                    name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                        }
                    ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                }
            ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
        }
    ], rootTestFolders: [
        {
            name: 'src', testFiles: [], folders: [
                {
                    name: 'src\\sub1', testFiles: [], folders: [
                        {
                            name: 'src\\sub1\\sub2', testFiles: [], folders: [
                                {
                                    name: 'src\\sub1\\sub2\\sub3', testFiles: [], folders: [
                                        {
                                            name: 'src\\sub1\\sub2\\sub3\\sub4', testFiles: [], folders: [
                                                {
                                                    name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', testFiles: [], folders: [
                                                        {
                                                            name: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', testFiles: [
                                                                {
                                                                    functions: [], suites: [
                                                                        {
                                                                            name: 'TestDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness', functions: [
                                                                                {
                                                                                    name: 'test_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep', time: 0
                                                                                },
                                                                                {
                                                                                    name: 'test_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestDeepness::test_deep_fail', time: 0
                                                                                }
                                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestDeepness', time: 0
                                                                        },
                                                                        {
                                                                            name: 'TestSuiteDeepness', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness', functions: [
                                                                                {
                                                                                    name: 'test_suite_deep', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep', time: 0
                                                                                },
                                                                                {
                                                                                    name: 'test_suite_deep_fail', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py::TestSuiteDeepness::test_suite_deep_fail', time: 0
                                                                                }
                                                                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness.TestSuiteDeepness', time: 0
                                                                        }
                                                                    ], name: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\deep_test_file\\src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6\\test_deepness.py', nameToRun: 'src/sub1/sub2/sub3/sub4/sub5/sub6/test_deepness.py', xmlName: 'src.sub1.sub2.sub3.sub4.sub5.sub6.test_deepness', time: 0
                                                                }
                                                            ], folders: [], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5\\sub6', time: 0
                                                        }
                                                    ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4\\sub5', time: 0
                                                }
                                            ], nameToRun: 'src\\sub1\\sub2\\sub3\\sub4', time: 0
                                        }
                                    ], nameToRun: 'src\\sub1\\sub2\\sub3', time: 0
                                }
                            ], nameToRun: 'src\\sub1\\sub2', time: 0
                        }
                    ], nameToRun: 'src\\sub1', time: 0
                }
            ], nameToRun: 'src', time: 0
        }
    ], summary: {
        passed: 0, failures: 0, errors: 0, skipped: 0
    }
};
export const expected_singleTestAtRoot: Tests = {
    testFiles: [
        {
            functions: [], suites: [
                {
                    name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                },
                {
                    name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                        {
                            name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                        },
                        {
                            name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                }
            ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
        }
    ], testFunctions: [
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleTestAtRoot', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleTestAtRoot', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleAtRootSuite', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleAtRootSuite', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
            }
        }
    ], testSuites: [
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, testSuite: {
                name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleTestAtRoot'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                    },
                    {
                        name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                    }
                ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
            }, testSuite: {
                name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
            }, xmlClassName: 'test_single_at_root.TestSingleAtRootSuite'
        }
    ], testFolders: [
        {
            name: '.', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                        },
                        {
                            name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                        }
                    ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
                }
            ], folders: [], nameToRun: '.', time: 0
        }
    ], rootTestFolders: [
        {
            name: '.', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestSingleTestAtRoot', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_single_at_root.py::TestSingleTestAtRoot::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleTestAtRoot', time: 0
                        },
                        {
                            name: 'TestSingleAtRootSuite', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_single_at_root.py::TestSingleAtRootSuite::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_single_at_root.TestSingleAtRootSuite', time: 0
                        }
                    ], name: 'test_single_at_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root\\test_single_at_root.py', nameToRun: 'test_single_at_root.py', xmlName: 'test_single_at_root', time: 0
                }
            ], folders: [], nameToRun: '.', time: 0
        }
    ], summary: {
        passed: 0, failures: 0, errors: 0, skipped: 0
    }
};
export const expected_singleTestSubRoot: Tests = {
    testFiles: [
        {
            functions: [], suites: [
                {
                    name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                },
                {
                    name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                        {
                            name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                        },
                        {
                            name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                }
            ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
        }
    ], testFunctions: [
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleTestSubRoot', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleTestSubRoot', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleSubRootSuite', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleSubRootSuite', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, parentTestSuite: {
                name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
            }
        }
    ], testSuites: [
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, testSuite: {
                name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleTestSubRoot'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                    },
                    {
                        name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                    }
                ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
            }, testSuite: {
                name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
            }, xmlClassName: 'test.test_single_sub_root.TestSingleSubRootSuite'
        }
    ], testFolders: [
        {
            name: 'test', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                        },
                        {
                            name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                        }
                    ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
                }
            ], folders: [], nameToRun: 'test', time: 0
        }
    ], rootTestFolders: [
        {
            name: 'test', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestSingleTestSubRoot', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test/test_single_sub_root.py::TestSingleTestSubRoot::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleTestSubRoot', time: 0
                        },
                        {
                            name: 'TestSingleSubRootSuite', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test/test_single_sub_root.py::TestSingleSubRootSuite::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test.test_single_sub_root.TestSingleSubRootSuite', time: 0
                        }
                    ], name: 'test/test_single_sub_root.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root\\test\\test_single_sub_root.py', nameToRun: 'test/test_single_sub_root.py', xmlName: 'test.test_single_sub_root', time: 0
                }
            ], folders: [], nameToRun: 'test', time: 0
        }
    ], summary: {
        passed: 0, failures: 0, errors: 0, skipped: 0
    }
};
export const expected_multiTestsAtRoot: Tests = {
    testFiles: [
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                }
            ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
        },
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                }
            ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
        },
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                }
            ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
        }
    ], testFunctions: [
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
            }, xmlClassName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                    }
                ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
            }, xmlClassName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                    }
                ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
            }, xmlClassName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                    }
                ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
            }, xmlClassName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                    }
                ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
            }, xmlClassName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                    }
                ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
            }, xmlClassName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                    }
                ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
            }
        }
    ], testSuites: [
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                    }
                ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
            }, testSuite: {
                name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
            }, xmlClassName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                    }
                ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
            }, testSuite: {
                name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
            }, xmlClassName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                    }
                ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
            }, testSuite: {
                name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
            }, xmlClassName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree'
        }
    ], testFolders: [
        {
            name: '.', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                        }
                    ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
                },
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                        }
                    ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
                },
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                        }
                    ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
                }
            ], folders: [], nameToRun: '.', time: 0
        }
    ], rootTestFolders: [
        {
            name: '.', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootOne', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_1.py::TestMultipleTestFilesAtRootOne::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_1.TestMultipleTestFilesAtRootOne', time: 0
                        }
                    ], name: 'test_multiple_at_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_1.py', nameToRun: 'test_multiple_at_root_1.py', xmlName: 'test_multiple_at_root_1', time: 0
                },
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootTwo', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_2.py::TestMultipleTestFilesAtRootTwo::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_2.TestMultipleTestFilesAtRootTwo', time: 0
                        }
                    ], name: 'test_multiple_at_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_2.py', nameToRun: 'test_multiple_at_root_2.py', xmlName: 'test_multiple_at_root_2', time: 0
                },
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestFilesAtRootThree', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_multiple_at_root_3.py::TestMultipleTestFilesAtRootThree::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_multiple_at_root_3.TestMultipleTestFilesAtRootThree', time: 0
                        }
                    ], name: 'test_multiple_at_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_at_root\\test_multiple_at_root_3.py', nameToRun: 'test_multiple_at_root_3.py', xmlName: 'test_multiple_at_root_3', time: 0
                }
            ], folders: [], nameToRun: '.', time: 0
        }
    ], summary: {
        passed: 0, failures: 0, errors: 0, skipped: 0
    }
};
export const expected_multiTestsSubRoot: Tests = {
    testFiles: [
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                },
                {
                    name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                        {
                            name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                        },
                        {
                            name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                }
            ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
        },
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                },
                {
                    name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                        {
                            name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                        },
                        {
                            name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                }
            ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
        },
        {
            functions: [], suites: [
                {
                    name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                        {
                            name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                        },
                        {
                            name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                },
                {
                    name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                        {
                            name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                        },
                        {
                            name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                        }
                    ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                }
            ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
        }
    ], testFunctions: [
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
            }
        },
        {
            testFunction: {
                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, parentTestSuite: {
                name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
            }
        }
    ], testSuites: [
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, testSuite: {
                name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                    }
                ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
            }, testSuite: {
                name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
            }, xmlClassName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, testSuite: {
                name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                    }
                ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
            }, testSuite: {
                name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
            }, xmlClassName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, testSuite: {
                name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                    {
                        name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                    },
                    {
                        name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo'
        },
        {
            parentTestFile: {
                functions: [], suites: [
                    {
                        name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                            {
                                name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                            },
                            {
                                name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                    },
                    {
                        name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                            {
                                name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                            },
                            {
                                name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                            }
                        ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                    }
                ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
            }, testSuite: {
                name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                    {
                        name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                    },
                    {
                        name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                    }
                ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
            }, xmlClassName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo'
        }
    ], testFolders: [
        {
            name: 'test_one', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                        }
                    ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
                }
            ], folders: [], nameToRun: 'test_one', time: 0
        },
        {
            name: 'test_three', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                        }
                    ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
                }
            ], folders: [], nameToRun: 'test_three', time: 0
        },
        {
            name: 'test_two', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                        }
                    ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
                }
            ], folders: [], nameToRun: 'test_two', time: 0
        }
    ], rootTestFolders: [
        {
            name: 'test_one', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleTestSubRootOne::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleTestSubRootOne', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteOne', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_one/test_multiple_sub_root_1.py::TestMultipleSubRootSuiteOne::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_one.test_multiple_sub_root_1.TestMultipleSubRootSuiteOne', time: 0
                        }
                    ], name: 'test_one/test_multiple_sub_root_1.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_one\\test_multiple_sub_root_1.py', nameToRun: 'test_one/test_multiple_sub_root_1.py', xmlName: 'test_one.test_multiple_sub_root_1', time: 0
                }
            ], folders: [], nameToRun: 'test_one', time: 0
        },
        {
            name: 'test_three', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleTestSubRootThree::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleTestSubRootThree', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteThree', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_three/test_multiple_sub_root_3.py::TestMultipleSubRootSuiteThree::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_three.test_multiple_sub_root_3.TestMultipleSubRootSuiteThree', time: 0
                        }
                    ], name: 'test_three/test_multiple_sub_root_3.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_three\\test_multiple_sub_root_3.py', nameToRun: 'test_three/test_multiple_sub_root_3.py', xmlName: 'test_three.test_multiple_sub_root_3', time: 0
                }
            ], folders: [], nameToRun: 'test_three', time: 0
        },
        {
            name: 'test_two', testFiles: [
                {
                    functions: [], suites: [
                        {
                            name: 'TestMultipleTestSubRootTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo', functions: [
                                {
                                    name: 'test_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_fail', time: 0
                                },
                                {
                                    name: 'test_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleTestSubRootTwo::test_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleTestSubRootTwo', time: 0
                        },
                        {
                            name: 'TestMultipleSubRootSuiteTwo', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo', functions: [
                                {
                                    name: 'test_suite_fail', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_fail', time: 0
                                },
                                {
                                    name: 'test_suite_success', nameToRun: 'test_two/test_multiple_sub_root_2.py::TestMultipleSubRootSuiteTwo::test_suite_success', time: 0
                                }
                            ], suites: [], isUnitTest: true, isInstance: false, xmlName: 'test_two.test_multiple_sub_root_2.TestMultipleSubRootSuiteTwo', time: 0
                        }
                    ], name: 'test_two/test_multiple_sub_root_2.py', fullPath: 'C:\\dev\\github\\d3r3kk\\test\\test_scenario\\multiple_test_files_sub_root\\test_two\\test_multiple_sub_root_2.py', nameToRun: 'test_two/test_multiple_sub_root_2.py', xmlName: 'test_two.test_multiple_sub_root_2', time: 0
                }
            ], folders: [], nameToRun: 'test_two', time: 0
        }
    ], summary: {
        passed: 0, failures: 0, errors: 0, skipped: 0
    }
};

pytestScenario.push({ json: json_singleTestAtRoot, expectedResult: expected_singleTestAtRoot, expectedTestFiles: JSON.parse(json_testFiles_singleTestFileAtRoot), scenarioDescription: 'Single test file at root of workspace' });
// pytestScenario.push({ json: json_singleTestSubRoot, expectedResult: expected_singleTestSubRoot, expectedTestFiles: JSON.parse(json_testFiles_singleTestFileSubRoot), scenarioDescription: 'Single test file in a subdir of workspace' });
// pytestScenario.push({ json: json_multiTestsAtRoot, expectedResult: expected_multiTestsAtRoot, expectedTestFiles: JSON.parse(json_testFiles_multiTestFileAtRoot), scenarioDescription: 'Multiple test files at root of workspace' });
// pytestScenario.push({ json: json_multiTestsSubRoot, expectedResult: expected_multiTestsSubRoot, expectedTestFiles: JSON.parse(json_testFiles_multiTestFilesSubRoot), scenarioDescription: 'Multiple test files in a subdir of workspace' });
// pytestScenario.push({ json: json_deepFolderTest, expectedResult: expected_deepFolderTest, expectedTestFiles: JSON.parse(json_testFiles_deepTestFile), scenarioDescription: 'Deep subdirectories constaining test' });
