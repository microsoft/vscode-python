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

    Scenario Outline: When running tests, the nodes will have the progress icon and clicking stop will stop running (<package>)
        Given the package "<package>" is installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the nodes in the test explorer
        And the file "tests/test_running_delay" has the following content
            """
            10
            """
        When I select the command "Python: Run All Tests"
        Then all of the test tree nodes have a progress icon
        And the stop icon is visible in the toolbar
        When I stop running tests
        Then the stop icon is not visible in the toolbar

        Examples:
            | package  | setting_to_enable |
            | unittest | unittestEnabled   |
            | pytest   | pytestEnabled     |
            | nose     | nosetestsEnabled  |
