@test
Feature: Discovery Prompts
    Scenario: Discover will display prompt to configure when not configured
        Given the file ".vscode/settings.json" does not exist
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then a message containing the text "No test framework configured" is displayed

    Scenario: Discover will prompt to install pytest
        Given the package "pytest" is not installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then a message containing the text "pytest is not installed" is displayed

    Scenario: Discover will prompt to install nose
        Given the package "nose" is not installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then a message containing the text "nosetest is not installed" is displayed

    Scenario: Discover will display prompt indicating there are no tests (unittest)
        Given a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.testing.unittestArgs": ["-v","-s",".","-p","*test*.py"],
            "python.testing.pyTestEnabled": false,
            "python.testing.nosetestsEnabled": false,
            "python.testing.unittestEnabled": true
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No tests discovered" is displayed

    Scenario: Discover will display prompt indicating there are no tests (pytest)
        Given the package "pytest" is installed
        And a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.testing.pyTestEnabled": true,
            "python.testing.nosetestsEnabled": false,
            "python.testing.unittestEnabled": false,
            "python.testing.pyTestArgs": ["."],
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No tests discovered" is displayed

    Scenario: Discover will display prompt indicating there are no tests (nose)
        Given the package "nose" is installed
        And a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.testing.pyTestEnabled": false,
            "python.testing.nosetestsEnabled": true,
            "python.testing.unittestEnabled": false,
            "python.testing.nosetestArgs": ["."]
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No tests discovered" is displayed
