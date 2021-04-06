# https://github.com/DonJayamanne/pythonVSCode/issues/962

class A:
    def __init__(self):
        self.test_value = 0

    async def test(self):
        pass

    async def test2(self):
        await self.test()

async def testthis():
    """
    Wow
    """
    pass

await testthis()