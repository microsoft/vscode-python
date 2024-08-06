from django.test.runner import DiscoverRunner


class CustomTestRunner2(DiscoverRunner):
    def run_tests(self, test_labels, extra_tests=None, **kwargs):
        # Set up the test environment
        self.setup_test_environment()

        # Set up the test databases
        old_config = self.setup_databases()

        # Call the default build_suite method to create the test suite
        suite = self.build_suite(test_labels, extra_tests, **kwargs)

        # Print out the test suite
        test_names = [str(test) for test in suite]
        for name in sorted(test_names):
            print(name)

        # Optionally, prevent the tests from running by returning early
        # return 0  # Uncomment this line to skip test execution

        # Run the tests normally
        result = self.test_runner(
            verbosity=self.verbosity, failfast=self.failfast, keepdb=self.keepdb
        ).run(suite)

        # Tear down the test databases
        self.teardown_databases(old_config)

        # Tear down the test environment
        self.teardown_test_environment()

        return self.suite_result(suite, result)
