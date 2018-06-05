import os

def one():
    return True

def two():
    if one():
        print("A" + one())
