// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// disable the ' quotemark, as we need to consume many strings from stdout that use that
// test delimiter exclusively.

// tslint:disable:quotemark

export enum PytestDataPlatformType {
    NonWindows = 'non-windows',
    Windows = 'windows'
}

export type PytestDiscoveryScenario = {
    pytest_version_spec: string;
    platform: string;
    description: string;
    rootdir: string;
    test_functions: string[];
    functionCount: number;
    stdout: string[];
};

// Data to test the pytest unit test parser with. See pytest.discovery.unit.test.ts.
export const pytestScenarioData: PytestDiscoveryScenario[] =
    [
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, tests throughout a deeper tree, including 2 distinct folder paths at different levels.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "src/test_things.py::test_things_major",
                "test/this/is/deep/testing/test_very_deeply.py::test_math_works"
            ],
            functionCount: 9,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 9 items",
                "<Module 'src/test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'src/under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'src/under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "<Module 'test/test_other_other_things.py'>",
                "  <Function 'test_sys_ver'>",
                "<Module 'test/test_other_things.py'>",
                "  <Function 'test_sys_ver'>",
                "<Module 'test/this/is/deep/testing/test_deeply.py'>",
                "  <Function 'test_json_works'>",
                "  <Function 'test_json_numbers_work'>",
                "<Module 'test/this/is/deep/testing/test_very_deeply.py'>",
                "  <Function 'test_math_works'>",
                "",
                "========================= no tests ran in 0.02 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, tests throughout a deeper tree, including 2 distinct folder paths at different levels.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "src/test_things.py::test_things_major",
                "test/this/is/deep/testing/test_very_deeply.py::test_math_works"
            ],
            functionCount: 9,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 9 items",
                "<Module 'src/test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'src/under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'src/under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "<Module 'test/test_other_other_things.py'>",
                "  <Function 'test_sys_ver'>",
                "<Module 'test/test_other_things.py'>",
                "  <Function 'test_sys_ver'>",
                "<Module 'test/this/is/deep/testing/test_deeply.py'>",
                "  <Function 'test_json_works'>",
                "  <Function 'test_json_numbers_work'>",
                "<Module 'test/this/is/deep/testing/test_very_deeply.py'>",
                "  <Function 'test_math_works'>",
                "",
                "========================= no tests ran in 0.18 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in subfolders of root, and 2 more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "src/test_things.py::test_things_major",
                "src/under/test_stuff.py::test_platform"
            ],
            functionCount: 5,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 5 items",
                "<Module 'src/test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'src/test_things_again.py'>",
                "  <Function 'test_it_over_again'>",
                "<Module 'src/under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'src/under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.05 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in subfolders of root, and 2 more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "src/test_things.py::test_things_major",
                "src/under/test_stuff.py::test_platform"
            ],
            functionCount: 5,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 5 items",
                "<Module 'src/test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'src/test_things_again.py'>",
                "  <Function 'test_it_over_again'>",
                "<Module 'src/under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'src/under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.03 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in root folder and two more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_things.py::test_things_major",
                "under/test_stuff.py::test_platform"
            ],
            functionCount: 5,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 5 items",
                "<Module 'test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'test_things_again.py'>",
                "  <Function 'test_it_over_again'>",
                "<Module 'under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.12 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in root folder and two more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_things.py::test_things_major",
                "under/test_stuff.py::test_platform"
            ],
            functionCount: 5,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 5 items",
                "<Module 'test_things.py'>",
                "  <Function 'test_things_major'>",
                "  <Function 'test_things_minor'>",
                "<Module 'test_things_again.py'>",
                "  <Function 'test_it_over_again'>",
                "<Module 'under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.12 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in a subfolder off the root.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "under/test_other_stuff.py::test_machine_values",
                "under/test_stuff.py::test_platform"
            ],
            functionCount: 2,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 2 items",
                "<Module 'under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.06 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 test modules in a subfolder off the root.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "under/test_other_stuff.py::test_machine_values",
                "under/test_stuff.py::test_platform"
            ],
            functionCount: 2,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 2 items",
                "<Module 'under/test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'under/test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.05 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 modules at the topmost level.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_other_stuff.py::test_machine_values",
                "test_stuff.py::test_platform"
            ],
            functionCount: 2,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 2 items",
                "<Module 'test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.05 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Non-package source, 2 modules at the topmost level.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_other_stuff.py::test_machine_values",
                "test_stuff.py::test_platform"
            ],
            functionCount: 2,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 2 items",
                "<Module 'test_other_stuff.py'>",
                "  <Function 'test_machine_values'>",
                "<Module 'test_stuff.py'>",
                "  <Function 'test_platform'>",
                "",
                "========================= no tests ran in 0.05 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, tests throughout a deeper tree, including 2 distinct folder paths at different levels.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_basic_root.py::test_basic_major",
                "test/test_other_basic.py::test_basic_major_minor_internal",
                "test/subdir/under/another/subdir/test_other_basic_sub.py::test_basic_major_minor"
            ],
            functionCount: 16,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 16 items",
                "<Module 'test_basic_root.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_other_basic_root.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/test_basic.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_other_basic.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/subdir/under/another/subdir/test_basic_sub.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/subdir/under/another/subdir/test_other_basic_sub.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/uneven/folders/test_basic_uneven.py'>",
                "  <Function 'test_basic_major_uneven'>",
                "  <Function 'test_basic_minor_uneven'>",
                "<Module 'test/uneven/folders/test_other_basic_uneven.py'>",
                "  <Function 'test_basic_major_minor_uneven'>",
                "  <Function 'test_basic_major_minor_internal_uneven'>",
                "",
                "========================= no tests ran in 0.07 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, tests throughout a deeper tree, including 2 distinct folder paths at different levels.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_basic_root.py::test_basic_major",
                "test/test_other_basic.py::test_basic_major_minor_internal",
                "test/subdir/under/another/subdir/test_other_basic_sub.py::test_basic_major_minor",
                "test/uneven/folders/test_other_basic_uneven.py::test_basic_major_minor_internal_uneven"
            ],
            functionCount: 16,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 16 items",
                "<Package '/home/user/test/pytest_scenario'>",
                "  <Module 'test_basic_root.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_other_basic_root.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "  <Package '/home/user/test/pytest_scenario/test'>",
                "    <Module 'test_basic.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_other_basic.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "    <Package '/home/user/test/pytest_scenario/test/subdir'>",
                "      <Package '/home/user/test/pytest_scenario/test/subdir/under'>",
                "        <Package '/home/user/test/pytest_scenario/test/subdir/under/another'>",
                "          <Package '/home/user/test/pytest_scenario/test/subdir/under/another/subdir'>",
                "            <Module 'test_basic_sub.py'>",
                "              <Function 'test_basic_major'>",
                "              <Function 'test_basic_minor'>",
                "            <Module 'test_other_basic_sub.py'>",
                "              <Function 'test_basic_major_minor'>",
                "              <Function 'test_basic_major_minor_internal'>",
                "    <Package '/home/user/test/pytest_scenario/test/uneven'>",
                "      <Package '/home/user/test/pytest_scenario/test/uneven/folders'>",
                "        <Module 'test_basic_uneven.py'>",
                "          <Function 'test_basic_major_uneven'>",
                "          <Function 'test_basic_minor_uneven'>",
                "        <Module 'test_other_basic_uneven.py'>",
                "          <Function 'test_basic_major_minor_uneven'>",
                "          <Function 'test_basic_major_minor_internal_uneven'>",
                "",
                "========================= no tests ran in 0.13 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2 test modules in subfolders of root, and 2 more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test/test_other_basic.py::test_basic_major_minor_internal",
                "test/subdir/test_other_basic_sub.py::test_basic_major_minor"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Module 'test/test_basic.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_basic_root.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_other_basic.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/test_other_basic_root.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/subdir/test_basic_sub.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/subdir/test_other_basic_sub.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.18 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2 test modules in subfolders of root, and 2 more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test/test_other_basic.py::test_basic_major_minor_internal",
                "test/subdir/test_other_basic_sub.py::test_basic_major_minor"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Package '/home/user/test/pytest_scenario'>",
                "  <Package '/home/user/test/pytest_scenario/test'>",
                "    <Module 'test_basic.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_basic_root.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_other_basic.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "    <Module 'test_other_basic_root.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "    <Package '/home/user/test/pytest_scenario/test/subdir'>",
                "      <Module 'test_basic_sub.py'>",
                "        <Function 'test_basic_major'>",
                "        <Function 'test_basic_minor'>",
                "      <Module 'test_other_basic_sub.py'>",
                "        <Function 'test_basic_major_minor'>",
                "        <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.07 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ test modules in root folder and two more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_other_basic_root.py::test_basic_major_minor_internal",
                "test/test_other_basic_sub.py::test_basic_major_minor"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Module 'test_basic.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_basic_root.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_other_basic.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test_other_basic_root.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/test_basic_sub.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_other_basic_sub.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.18 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ test modules in root folder and two more in one (direct) subfolder.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_other_basic_root.py::test_basic_major_minor_internal",
                "test/test_basic_sub.py::test_basic_major",
                "test/test_basic_sub.py::test_basic_minor"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Package '/home/user/test/pytest_scenario'>",
                "  <Module 'test_basic.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_basic_root.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_other_basic.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "  <Module 'test_other_basic_root.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "  <Package '/home/user/test/pytest_scenario/test'>",
                "    <Module 'test_basic_sub.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_other_basic_sub.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.22 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ test modules in a subfolder off the root.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test/test_basic.py::test_basic_minor",
                "test/test_other_basic.py::test_basic_major_minor",
                "test/test_other_basic_root.py::test_basic_major_minor",
                "test/test_other_basic_sub.py::test_basic_major_minor_internal"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Module 'test/test_basic.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_basic_root.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_basic_sub.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test/test_other_basic.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/test_other_basic_root.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test/test_other_basic_sub.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.15 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ test modules in a subfolder off the root.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test/test_basic.py::test_basic_minor",
                "test/test_other_basic.py::test_basic_major_minor",
                "test/test_other_basic_root.py::test_basic_major_minor",
                "test/test_other_basic_sub.py::test_basic_major_minor_internal"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Package '/home/user/test/pytest_scenario'>",
                "  <Package '/home/user/test/pytest_scenario/test'>",
                "    <Module 'test_basic.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_basic_root.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_basic_sub.py'>",
                "      <Function 'test_basic_major'>",
                "      <Function 'test_basic_minor'>",
                "    <Module 'test_other_basic.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "    <Module 'test_other_basic_root.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "    <Module 'test_other_basic_sub.py'>",
                "      <Function 'test_basic_major_minor'>",
                "      <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.15 seconds ========================="
            ]
        },
        {
            pytest_version_spec: "< 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ modules at the topmost level.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_basic.py::test_basic_major",
                "test_basic_root.py::test_basic_major",
                "test_other_basic_root.py::test_basic_major_minor",
                "test_other_basic_sub.py::test_basic_major_minor_internal"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.6.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Module 'test_basic.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_basic_root.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_basic_sub.py'>",
                "  <Function 'test_basic_major'>",
                "  <Function 'test_basic_minor'>",
                "<Module 'test_other_basic.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test_other_basic_root.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "<Module 'test_other_basic_sub.py'>",
                "  <Function 'test_basic_major_minor'>",
                "  <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.23 seconds ========================="
            ]
        },
        {
            pytest_version_spec: ">= 3.7",
            platform: PytestDataPlatformType.NonWindows,
            description: "Package-based source, 2+ modules at the topmost level.",
            rootdir: "/home/user/test/pytest_scenario",
            test_functions: [
                "test_basic.py::test_basic_major",
                "test_basic_root.py::test_basic_major",
                "test_other_basic_root.py::test_basic_major_minor",
                "test_other_basic_sub.py::test_basic_major_minor_internal"
            ],
            functionCount: 12,
            stdout: [
                "============================= test session starts ==============================",
                "platform linux -- Python 3.7.0+, pytest-3.7.4, py-1.6.0, pluggy-0.7.1",
                "rootdir: /home/user/test/pytest_scenario, inifile:",
                "collected 12 items",
                "<Package '/home/user/test/pytest_scenario'>",
                "  <Module 'test_basic.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_basic_root.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_basic_sub.py'>",
                "    <Function 'test_basic_major'>",
                "    <Function 'test_basic_minor'>",
                "  <Module 'test_other_basic.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "  <Module 'test_other_basic_root.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "  <Module 'test_other_basic_sub.py'>",
                "    <Function 'test_basic_major_minor'>",
                "    <Function 'test_basic_major_minor_internal'>",
                "",
                "========================= no tests ran in 0.16 seconds ========================="
            ]
        }
    ];
