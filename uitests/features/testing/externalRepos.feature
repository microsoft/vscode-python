@testing
@wip
Feature: Test Explorer
    @https://github.com/microsoft/ptvsd
    Scenario: Tests in PTVSD repo will be discovered without any errors
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
                "python.testing.unittestEnabled": false,
                "python.testing.nosetestsEnabled": false,
                "python.testing.pytestEnabled": true
            }
            """
        And the python command "-m pip install -r test_requirements.txt" has been executed
        And the Python extension has been activated
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        When I expand all of the nodes in the test explorer
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed

    @https://github.com/pytest-dev/pytest
    Scenario: Tests in pytest repo will be discovered without any errors
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
                "python.testing.unittestEnabled": false,
                "python.testing.nosetestsEnabled": false,
                "python.testing.pytestEnabled": true
            }
            """
        And the python command "-m pip install -e ." has been executed
        And the python command "-m pip install .[testing]" has been executed
        Given the Python extension has been activated
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        When I expand all of the nodes in the test explorer
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed

    @https://github.com/pallets/flask
    Scenario: Tests in flask repo will be discovered without any errors
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
                "python.testing.unittestEnabled": false,
                "python.testing.nosetestsEnabled": false,
                "python.testing.pytestEnabled": true
            }
            """
        And the python command "-m pip install -e ." has been executed
        And the python command "-m pip install .[dev]" has been executed
        Given the Python extension has been activated
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        When I expand all of the nodes in the test explorer
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed
