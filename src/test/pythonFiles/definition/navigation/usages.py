import definitions
from .definitions import my_context_manager, my_decorator, thing

@definitions.my_decorator
def one():
    pass

@my_decorator
def two():
    pass

with definitions.my_context_manager():
    definitions.thing(19)

with my_context_manager():
    thing(19)
