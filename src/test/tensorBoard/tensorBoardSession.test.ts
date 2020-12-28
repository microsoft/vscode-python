suite('TensorBoard session creation', async () => {
    // Test this with conda env etc
    test('Golden path: tensorboard session successfully starts and webview panel is created');
    test('If tensorboard is not installed, prompt the user to install tensorboard');
    test('If tensorboard is installed, do not prompt the user to install tensorboard');
    test('If no active Python interpreter, ask the user to select active interpreter');
    test('If active Python interpreter is already selected, do not prompt user to select active interpreter');
    test('If tensorboard installation fails, show user error message');
    test('If tensorboard session creation times out, show user error message');
    test('If user cancels starting session, observable process should also be killed');
});
