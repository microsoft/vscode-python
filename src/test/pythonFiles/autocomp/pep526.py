

PEP_526_style: str = "hello world"
captain: str  # Note: no initial value!
PEP_484_style = SOMETHING # type: str

 
PEP_484_style.upper()
PEP_526_style.upper()
captain.upper()

# https://github.com/DonJayamanne/pythonVSCode/issues/918
class A:
    a = 0


class B:
    b: int = 0


A().a  # -> Autocomplete works
B().b.bit_length()  # -> Autocomplete doesn't work