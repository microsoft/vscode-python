@testing
@https://github.com/DonJayamanne/pyvscSmokeTesting/testing
Feature: Test Explorer
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

    Scenario Outline: When running tests, the nodes will have the progress icon and when completed will have a success status (<package>)
        Given the package "<package>" is installed
        And a file named "tests/test_running_delay" is created with the following content
            """
            5
            """
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        Then there are <node_count> nodes in the test explorer
        And <node_count> nodes in the test explorer have a status of "Unknown"
        When I run the node "test_two_first_suite" from the test explorer
        Then the stop icon is visible in the toolbar
        And 1 node in the test explorer has a status of "Progress"
        And the node "test_two_first_suite" in the test explorer has a status of "Progress"
        When I wait for tests to complete running
        Then the node "<test_one_file_label>" in the test explorer has a status of "Success"
        And the node "TestFirstSuite" in the test explorer has a status of "Success"
        And the node "test_two_first_suite" in the test explorer has a status of "Success"
        And 11 nodes in the test explorer have a status of "Unknown"

        Examples:
            | package  | setting_to_enable | node_count | test_one_file_label |
            | unittest | unittestEnabled   | 14         | test_one.py         |
            | pytest   | pytestEnabled     | 15         | test_one.py         |
            | nose     | nosetestsEnabled  | 14         | tests/test_one.py   |

    Scenario Outline: When running tests, the nodes will have the progress icon and when completed will have a error status (<package>)
        Given the package "<package>" is installed
        And a file named "tests/test_running_delay" is created with the following content
            """
            5
            """
        And a file named "tests/data.json" is created with the following content
            """
            [1,2,-1,4,5,6]
            """
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        # Then I wait for 1000 seconds
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        Then there are <node_count> nodes in the test explorer
        And <node_count> nodes in the test explorer have a status of "Unknown"
        When I run the node "test_three_first_suite" from the test explorer
        Then the stop icon is visible in the toolbar
        And 1 node in the test explorer has a status of "Progress"
        And the node "test_three_first_suite" in the test explorer has a status of "Progress"
        When I wait for tests to complete running
        Then the node "<test_one_file_label>" in the test explorer has a status of "Fail"
        And the node "TestFirstSuite" in the test explorer has a status of "Fail"
        And the node "test_three_first_suite" in the test explorer has a status of "Fail"
        And 11 nodes in the test explorer have a status of "Unknown"

        Examples:
            | package  | setting_to_enable | node_count | test_one_file_label |
            | unittest | unittestEnabled   | 14         | test_one.py         |
            | pytest   | pytestEnabled     | 15         | test_one.py         |
            | nose     | nosetestsEnabled  | 14         | tests/test_one.py   |
