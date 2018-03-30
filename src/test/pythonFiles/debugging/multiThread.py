print("step1")
import sys
import threading
import time
print("step2")

def bar():
    print("step2-loop")
    time.sleep(2)
    print("abcdef")

def foo(x):
    while True:
        print('step2-{}'.format(threading.current_thread().getName()))
        print("step2-while-loop")
        bar()
print("step3")
threading.Thread(target=lambda: foo(2), name="foo").start()
print("step4")
foo(1)
print("step5")
