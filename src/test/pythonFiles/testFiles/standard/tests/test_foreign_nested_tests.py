from .external import ForeignTests


class TestNestedForeignTests:
    class TestInheritingHere(ForeignTests):
        def test_nested_normal(self):
            assert True
    def test_normal(self):
        assert True
