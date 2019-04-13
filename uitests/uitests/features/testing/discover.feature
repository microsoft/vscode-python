@test
Feature: Discovery Prompts

    Scenario: Discover will display prompt to configure when not configured
        Given the file ".vscode/settings.json" does not exist
        When I reload VSC
        When I select the command "Python: Discover Unit Tests"
        Then a message containing the text "No test framework configured" is displayed

    Scenario: Discover will prompt to install pytest
        Given the package "pytest" is not installed
        And the workspace setting "python.unitTest.pyTestEnabled" is enabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is disabled
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then a message containing the text "pytest is not installed" is displayed

    Scenario: Discover will prompt to install nose
        Given the package "nose" is not installed
        And the workspace setting "python.unitTest.pyTestEnabled" is disabled
        And the workspace setting "python.unitTest.unittestEnabled" is disabled
        And the workspace setting "python.unitTest.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then a message containing the text "nosetest is not installed" is displayed

    Scenario: Discover will display prompt indicating there are no tests (unittest)
        Given a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.unitTest.unittestArgs": ["-v","-s",".","-p","*test*.py"],
            "python.unitTest.pyTestEnabled": false,
            "python.unitTest.nosetestsEnabled": false,
            "python.unitTest.unittestEnabled": true
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then a message containing the text "No tests discovered" is displayed

    Scenario: Discover will display prompt indicating there are no tests (pytest)
        Given the package "pytest" is installed
        And a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.unitTest.pyTestEnabled": true,
            "python.unitTest.nosetestsEnabled": false,
            "python.unitTest.unittestEnabled": false,
            "python.unitTest.pyTestArgs": ["."],
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then a message containing the text "No tests discovered" is displayed

    Scenario: Discover will display prompt indicating there are no tests (nose)
        Given the package "nose" is installed
        And a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.unitTest.pyTestEnabled": false,
            "python.unitTest.nosetestsEnabled": true,
            "python.unitTest.unittestEnabled": false,
            "python.unitTest.nosetestArgs": ["."]
            }
            """
        When I reload VSC
        And I select the command "Python: Discover Unit Tests"
        Then a message containing the text "No tests discovered" is displayed
