// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use global_virtualenvs::list_global_virtual_envs;
use known::EnvironmentApi;
use locator::Locator;
use log::LevelFilter;
use messaging::{create_dispatcher, MessageDispatcher};
use std::time::SystemTime;

use crate::messaging::initialize_logger;

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
mod windows_python;

fn main() {
    let mut dispatcher = create_dispatcher();
    let environment = EnvironmentApi {};
    initialize_logger(LevelFilter::Debug);

    log::info!("Starting Native Locator");
    let now = SystemTime::now();

    let mut virtualenv_locator = virtualenv::VirtualEnv::new();
    let mut venv_locator = venv::Venv::new();
    let mut virtualenvwrapper_locator = virtualenvwrapper::VirtualEnvWrapper::with(&environment);
    let mut pipenv_locator = pipenv::PipEnv::new();
    let mut path_locator = common_python::PythonOnPath::with(&environment);
    let mut pyenv_locator = pyenv::PyEnv::with(&environment);
    #[cfg(unix)]
    let mut homebrew_locator = homebrew::Homebrew::with(&environment);
    #[cfg(windows)]
    let mut windows_locator = windows_python::WindowsPython::with(&environment);
    let mut conda_locator = conda::Conda::with(&environment);

    // These environments take predence over all others.
    // As they are very specific and guaranteed to be specific type.
    pyenv_locator.gather();
    #[cfg(unix)]
    homebrew_locator.gather();
    conda_locator.gather();

    // Finds Windows Store, Known Path, and Registry pythons
    #[cfg(windows)]
    windows_locator.gather();

    for env in list_global_virtual_envs(&environment).iter() {
        if pyenv_locator.is_known(&env.executable) {
            continue;
        }
        #[cfg(windows)]
        if windows_locator.is_known(&env.executable) {
            continue;
        }
        if conda_locator.is_known(&env.executable) {
            continue;
        }
        #[cfg(unix)]
        if homebrew_locator.is_known(&env.executable) {
            continue;
        }

        if pipenv_locator.track_if_compatible(&env) {
            continue;
        }
        if virtualenvwrapper_locator.track_if_compatible(&env) {
            continue;
        }
        if venv_locator.track_if_compatible(&env) {
            continue;
        }
        if virtualenv_locator.track_if_compatible(&env) {
            continue;
        }
    }

    // Finds python on PATH
    // This is the last place to look for unknown python environments.
    path_locator.gather();

    let all_locators: [&dyn Locator; 8] = [
        &virtualenv_locator,
        &venv_locator,
        &virtualenvwrapper_locator,
        &pipenv_locator,
        &path_locator,
        &pyenv_locator,
        #[cfg(unix)]
        &homebrew_locator,
        #[cfg(windows)]
        &windows_locator,
        &conda_locator,
    ];
    all_locators
        .iter()
        .for_each(|locator| locator.report(&mut dispatcher));

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
