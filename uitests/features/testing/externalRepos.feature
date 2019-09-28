@testing @python3
Feature: Test Explorer
    """
    Remember pytest requires python3.
    """
    @https://github.com/microsoft/ptvsd
    Scenario: Pytest Tests in PTVSD repo will be discovered without any errors
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
        # We have no idea how many tests there are, we know there will be atleast 10.
        # Let not increase it to 50, depends on how many tree items are visible in UI.
        # When checking number of nodes, the tests check the number of visible nodes.
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed

    @https://github.com/pytest-dev/pytest
    Scenario: Pytest tests in pytest repo will be discovered without any errors
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
        # We have no idea how many tests there are, we know there will be atleast 10.
        # Let not increase it to 50, depends on how many tree items are visible in UI.
        # When checking number of nodes, the tests check the number of visible nodes.
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed

    @https://github.com/pallets/flask
    Scenario: Pytest tests in flask repo will be discovered without any errors
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
                "python.testing.unittestEnabled": false,
                "python.testing.nosetestsEnabled": false,
                "python.testing.pytestEnabled": true
            }
            """
        And a file named ".env" is created with the following content
            """
            PYTHONPATH=./src
            """
        And the python command "-m pip install -e ." has been executed
        And the python command "-m pip install .[dev]" has been executed
        Given the Python extension has been activated
        When I select the command "Python: Discover Tests"
        And I wait for test discovery to complete
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        When I expand all of the nodes in the test explorer
        # We have no idea how many tests there are, we know there will be atleast 10.
        # Let not increase it to 50, depends on how many tree items are visible in UI.
        # When checking number of nodes, the tests check the number of visible nodes.
        Then there are at least 10 nodes in the test explorer
        And a status bar item containing the text 'Run Tests' is displayed
