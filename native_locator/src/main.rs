// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::messaging::initialize_logger;
use log::LevelFilter;
use messaging::{create_dispatcher, MessageDispatcher};
use python_finder::find_and_report_envs;
use std::time::SystemTime;

mod common_python;
mod conda;
mod global_virtualenvs;
mod homebrew;
mod known;
mod locator;
mod logging;
mod messaging;
mod pipenv;
mod pyenv;
mod utils;
mod venv;
mod virtualenv;
mod virtualenvwrapper;
mod windows_registry;
mod windows_store;

fn main() {
    initialize_logger(LevelFilter::Trace);

    log::info!("Starting Native Locator");
    let now = SystemTime::now();
    let mut dispatcher = create_dispatcher();

    find_and_report_envs();

    match now.elapsed() {
        Ok(elapsed) => {
            log::info!("Native Locator took {} milliseconds.", elapsed.as_millis());
        }
        Err(e) => {
            log::error!("Error getting elapsed time: {:?}", e);
        }
    }

    dispatcher.exit();
}
