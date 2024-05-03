// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::time::SystemTime;

mod common_python;
mod conda;
mod known;
mod logging;
mod messaging;
mod utils;
mod windows_python;

fn main() {
    let now = SystemTime::now();
    logging::log_info("Starting Native Locator");

    // Finds python on PATH
    common_python::find_and_report();

    // Finds conda binary and conda environments
    conda::find_and_report();

    // Finds Windows Store, Known Path, and Registry pythons
    #[cfg(windows)]
    windows_python::find_and_report();

    match now.elapsed() {
        Ok(elapsed) => {
            logging::log_info(&format!(
                "Native Locator took {} milliseconds.",
                elapsed.as_millis()
            ));
        }
        Err(e) => {
            logging::log_error(&format!("Error getting elapsed time: {:?}", e));
        }
    }

    messaging::send_message(messaging::ExitMessage::new());
}
