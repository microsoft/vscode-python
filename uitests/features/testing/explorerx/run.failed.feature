# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Test Explorer - Re-run Failed Tests

#     Scenario: We are able to re-run a failed tests (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             1
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for tests to complete running
#         Then 14 nodes in the test explorer have a status of "Success"

#     Scenario: We are able to re-run a failed tests (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer
#         And 15 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             1
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for tests to complete running
#         Then 15 nodes in the test explorer have a status of "Success"

#     Scenario: We are able to re-run a failed tests (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "tests/test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "tests/test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             1
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for tests to complete running
#         Then 14 nodes in the test explorer have a status of "Success"

#     Scenario: We are able to stop tests after re-running failed tests (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             100
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for 1 seconds
#         Then the stop icon is visible in the toolbar
#         Then the node "TestFirstSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_first_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_first_suite" in the test explorer has a status of "Progress"
#         And the node "TestThirdSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_third_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_third_suite" in the test explorer has a status of "Progress"
#         And 6 nodes in the test explorer have a status of "Progress"
#         When I stop running tests
#         And I wait for tests to complete running
#         Then the stop icon is not visible in the toolbar
#         And the node "test_three_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_three_third_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_third_suite" in the test explorer has a status of "Unknown"


#     Scenario: We are able to stop tests after re-running failed tests (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer
#         And 15 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             100
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for 1 seconds
#         Then the stop icon is visible in the toolbar
#         Then the node "TestFirstSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_first_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_first_suite" in the test explorer has a status of "Progress"
#         And the node "TestThirdSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_third_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_third_suite" in the test explorer has a status of "Progress"
#         And 6 nodes in the test explorer have a status of "Progress"
#         When I stop running tests
#         And I wait for tests to complete running
#         Then the stop icon is not visible in the toolbar
#         And the node "test_three_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_three_third_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_third_suite" in the test explorer has a status of "Unknown"

#     Scenario: We are able to stop tests after re-running failed tests (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             0
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,-1,-1,4,5,6]
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I select the command "Python: Run All Tests"
#         And I wait for tests to complete running
#         Then the node "tests/test_one.py" in the test explorer has a status of "Fail"
#         And the node "TestFirstSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_first_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_first_suite" in the test explorer has a status of "Fail"
#         And the node "tests/test_two.py" in the test explorer has a status of "Fail"
#         And the node "TestThirdSuite" in the test explorer has a status of "Fail"
#         And the node "test_three_third_suite" in the test explorer has a status of "Fail"
#         And the node "test_two_third_suite" in the test explorer has a status of "Fail"
#         And 6 nodes in the test explorer have a status of "Success"
#         And the run failed tests icon is visible in the toolbar
#         Given a file named "tests/test_running_delay" is created with the following content
#             """
#             100
#             """
#         And a file named "tests/data.json" is created with the following content
#             """
#             [1,2,3,4,5,6]
#             """
#         When I run failed tests
#         And I wait for 1 seconds
#         Then the stop icon is visible in the toolbar
#         Then the node "TestFirstSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_first_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_first_suite" in the test explorer has a status of "Progress"
#         And the node "TestThirdSuite" in the test explorer has a status of "Progress"
#         And the node "test_three_third_suite" in the test explorer has a status of "Progress"
#         And the node "test_two_third_suite" in the test explorer has a status of "Progress"
#         And 6 nodes in the test explorer have a status of "Progress"
#         When I stop running tests
#         And I wait for tests to complete running
#         Then the stop icon is not visible in the toolbar
#         And the node "test_three_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_first_suite" in the test explorer has a status of "Unknown"
#         And the node "test_three_third_suite" in the test explorer has a status of "Unknown"
#         And the node "test_two_third_suite" in the test explorer has a status of "Unknown"
