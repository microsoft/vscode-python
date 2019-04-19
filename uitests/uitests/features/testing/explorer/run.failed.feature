@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer - Re-run Failed Tests

    Scenario: We are able to re-run a failed tests (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            1
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I wait for tests to complete running
        Then 15 nodes have a status of "Success"

    Scenario: We are able to re-run a failed tests (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            1
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I wait for tests to complete running
        Then 15 nodes have a status of "Success"

    Scenario: We are able to re-run a failed tests (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            1
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I wait for tests to complete running
        Then 15 nodes have a status of "Success"


    Scenario: We are able to stop tests after re-running failed tests (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I stop running tests
        And I wait for tests to complete running
        Then the stop icon is not visible in the toolbar
        And the node number 5 has a status of "Unknown"
        And the node number 6 has a status of "Unknown"
        And the node number 14 has a status of "Unknown"
        And the node number 15 has a status of "Unknown"


    Scenario: We are able to stop tests after re-running failed tests (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I stop running tests
        And I wait for tests to complete running
        Then the stop icon is not visible in the toolbar
        And the node number 5 has a status of "Unknown"
        And the node number 6 has a status of "Unknown"
        And the node number 14 has a status of "Unknown"
        And the node number 15 has a status of "Unknown"


    Scenario: We are able to stop tests after re-running failed tests (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            0
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,-1,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I select the command "Python: Run All Tests"
        And I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And the node number 6 has a status of "Fail"
        And the node number 11 has a status of "Fail"
        And the node number 12 has a status of "Fail"
        And the node number 14 has a status of "Fail"
        And the node number 15 has a status of "Fail"
        And 6 nodes have a status of "Success"
        And the run failed tests icon is visible in the toolbar
        Given a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,3,4,5,6]
            """
        When I run failed tests
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 3 has a status of "Progress"
        And the node number 5 has a status of "Progress"
        And the node number 6 has a status of "Progress"
        And the node number 12 has a status of "Progress"
        And the node number 14 has a status of "Progress"
        And the node number 15 has a status of "Progress"
        And 6 nodes have a status of "Progress"
        When I stop running tests
        And I wait for tests to complete running
        Then the stop icon is not visible in the toolbar
        And the node number 5 has a status of "Unknown"
        And the node number 6 has a status of "Unknown"
        And the node number 14 has a status of "Unknown"
        And the node number 15 has a status of "Unknown"
