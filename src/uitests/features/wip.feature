@terminal
Feature: Terminal
    # Background: Activted Extension
    #     Given the Python extension has been activated

    Scenario: Open a terminal
        Then wait for 1 second
        Then log the message "Hello World"
        # Then wait for 15 seconds
        Then wait for 2 seconds
        Then log the message "Hello World"
        When I reload VS Code
        Then log the message "Hello World"
        Then wait for 3 second
        Then log the message "Hello World"
        When I close VS Code
        Then wait for 3 second
        When I start VS Code
        Then wait for 3 second
        When I close VS Code
        Then wait for 3 second
        When I close VS Code
        Then wait for 3 second
        When I open VS Code for the first time
        Then wait for 15 seconds

