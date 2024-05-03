// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

mod common_python;
mod conda;
mod known;
mod messaging;
mod utils;
mod windows_python;

fn main() {
    // Finds python on PATH
    common_python::find_and_report();

    // finds conda binary and conda environments
    conda::find_and_report();

    // Finds Windows Store, Known Path, and Registry pythons
    #[cfg(windows)]
    windows_python::find_and_report();

    messaging::send_message(messaging::ExitMessage::new());
}
