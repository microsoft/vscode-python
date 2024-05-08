// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::time::SystemTime;

use known::EnvironmentApi;
use messaging::{create_dispatcher, MessageDispatcher};

mod common_python;
mod conda;
mod global_virtualenvs;
mod homebrew;
mod known;
mod logging;
mod messaging;
mod pipenv;
mod pyenv;
mod utils;
mod windows_python;

fn main() {
    let mut dispatcher = create_dispatcher();
    let environment = EnvironmentApi {};

    dispatcher.log_info("Starting Native Locator");
    let now = SystemTime::now();

    // Finds python on PATH
    common_python::find_and_report(&mut dispatcher, &environment);

    // Finds conda binary and conda environments
    conda::find_and_report(&mut dispatcher, &environment);

    // Finds Windows Store, Known Path, and Registry pythons
    #[cfg(windows)]
    windows_python::find_and_report(&mut dispatcher, &environment);

    pyenv::find_and_report(&mut dispatcher, &environment);

    pipenv::find_and_report(&mut dispatcher, &environment);

    #[cfg(unix)]
    homebrew::find_and_report(&mut dispatcher, &environment);

    match now.elapsed() {
        Ok(elapsed) => {
            dispatcher.log_info(&format!(
                "Native Locator took {} milliseconds.",
                elapsed.as_millis()
            ));
        }
        Err(e) => {
            dispatcher.log_error(&format!("Error getting elapsed time: {:?}", e));
        }
    }

    dispatcher.exit();
}
