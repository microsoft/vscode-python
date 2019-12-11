@testing
@https://github.com/DonJayamanne/pyvscSmokeTesting/testing
Feature: Test Explorer (debugging)
    Background: Activted Extension
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
                "python.testing.unittestArgs": [
                    "-v",
                    "-s",
                    "./tests",
                    "-p",
                    "test_*.py"
                ],
                "python.testing.unittestEnabled": false,
                "python.testing.pytestArgs": ["."],
                "python.testing.pytestEnabled": false,
                "python.testing.nosetestArgs": ["."],
                "python.testing.nosetestsEnabled": false
            }
            """
        Given the Python extension has been activated

    Scenario Outline: When debugging tests, the nodes will have the progress icon and clicking stop will stop the debugger (<package>)
        Given the package "<package>" is installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        # The number entered in this file will be used in a `time.sleep(?)` statement.
        # Resulting in delays in running the tests (delay is in the python code in the above repo).
        Given a file named "tests/test_running_delay" is created with the following content
            """
            30
            """
        Then there are <node_count> nodes in the test explorer
        And <node_count> nodes in the test explorer have a status of "Unknown"
        When I debug the node "test_three_first_suite" from the test explorer
        Then the debugger starts
        When I select the command "Debug: Stop"
        Then the debugger stops

        Examples:
            | package  | setting_to_enable | node_count |
            | unittest | unittestEnabled   | 14         |
            | pytest   | pytestEnabled     | 15         |
            | nose     | nosetestsEnabled  | 14         |

    Scenario Outline: When debugging tests, only the specific function will be debugged (<package>)
        Given the package "<package>" is installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        When I add a breakpoint to line 33 in "tests/test_one.py"
        And I add a breakpoint to line 23 in "tests/test_one.py"
        And I debug the node "test_three_first_suite" from the test explorer
        Then the debugger starts
        And the debugger pauses
        And the current stack frame is at line 33 in "tests/test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger stops

        Examples:
            | package  | setting_to_enable |
            | unittest | unittestEnabled   |
            | pytest   | pytestEnabled     |
            | nose     | nosetestsEnabled  |

    Scenario Outline: When debugging tests, only the specific suite will be debugged (<package>)
        Given the package "<package>" is installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        When I add a breakpoint to line 33 in "tests/test_one.py"
        And I add a breakpoint to line 28 in "tests/test_one.py"
        And I add a breakpoint to line 23 in "tests/test_one.py"
        And I debug the node "TestFirstSuite" from the test explorer
        Then the debugger starts
        And the debugger pauses
        And the current stack frame is at line 23 in "tests/test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger pauses
        And the current stack frame is at line 33 in "tests/test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger pauses
        And the current stack frame is at line 28 in "tests/test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger stops

        Examples:
            | package  | setting_to_enable |
            | unittest | unittestEnabled   |
            | pytest   | pytestEnabled     |
            | nose     | nosetestsEnabled  |


    Scenario Outline: When debugging tests, everything will be debugged (<package>)
        Given the package "<package>" is installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        When I add a breakpoint to line 23 in "tests/test_one.py"
        And I add a breakpoint to line 38 in "tests/test_one.py"
        And I add a breakpoint to line 23 in "tests/test_two.py"
        And I select the command "Python: Debug All Tests"
        Then the debugger starts
        And the debugger pauses
        And the current stack frame is at line 23 in "test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger pauses
        And the current stack frame is at line 38 in "test_one.py"
        When I select the command "Debug: Continue"
        Then the debugger pauses
        And the current stack frame is at line 23 in "test_two.py"
        When I select the command "Debug: Continue"
        Then the debugger stops

        Examples:
            | package  | setting_to_enable |
            | unittest | unittestEnabled   |
            | pytest   | pytestEnabled     |
            | nose     | nosetestsEnabled  |
