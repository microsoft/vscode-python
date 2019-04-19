@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer

    Scenario: Explorer will be displayed when tests are discovered (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible

    Scenario: Explorer will be displayed when tests are discovered (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible

    Scenario: Explorer will be displayed when tests are discovered (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        And I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
