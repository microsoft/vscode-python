import sys

print(sys.executable)

class MyClass:
    def __init__(self):
        self.name = "Don"
        self.age = 123

    def say_something(self):
        print(self.age)
        print(self.name)
        return "ok"


x = MyClass()
print(x.say_something())
print(x.age)
print(x.name)