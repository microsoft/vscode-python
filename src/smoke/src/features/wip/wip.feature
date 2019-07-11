@terminal
Feature: Terminal
    @smoke
    Scenario: Open a terminal
        Then take a screenshot
        Then wait for 1 second
        When I select the command "Python: Create Terminal"
        Then take a screenshot
        Then wait for 1 second
        Then take a screenshot
        Then wait for 5 second
        Then take a screenshot
        Then wait for 5 second
        Then take a screenshot
