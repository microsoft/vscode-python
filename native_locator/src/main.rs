// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::messaging::initialize_logger;
use global_virtualenvs::list_global_virtual_envs;
use known::EnvironmentApi;
use locator::Locator;
use log::LevelFilter;
use messaging::{create_dispatcher, JsonRpcDispatcher, MessageDispatcher};
use std::time::SystemTime;
use utils::PythonEnv;

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
    let environment = EnvironmentApi {};
    initialize_logger(LevelFilter::Debug);

    log::info!("Starting Native Locator");
    let now = SystemTime::now();
    let mut dispatcher = create_dispatcher();

    let virtualenv_locator = virtualenv::VirtualEnv::new();
    let venv_locator = venv::Venv::new();
    let virtualenvwrapper_locator = virtualenvwrapper::VirtualEnvWrapper::with(&environment);
    let pipenv_locator = pipenv::PipEnv::new();
    let path_locator = common_python::PythonOnPath::with(&environment);
    let pyenv_locator = pyenv::PyEnv::with(&environment);

    #[cfg(unix)]
    let homebrew_locator = homebrew::Homebrew::with(&environment);
    #[cfg(windows)]
    let windows_locator = windows_python::WindowsPython::with(&environment);
    let conda_locator = conda::Conda::with(&environment);

    // Step 1: These environments take precedence over all others.
    // As they are very specific and guaranteed to be specific type.
    find_environments(&pyenv_locator, &mut dispatcher);
    #[cfg(unix)]
    find_environments(&homebrew_locator, &mut dispatcher);
    find_environments(&conda_locator, &mut dispatcher);
    #[cfg(windows)]
    find_environments(&windows_locator, &mut dispatcher);

    // Step 2: Search in some global locations.
    for env in list_global_virtual_envs(&environment).iter() {
        if dispatcher.was_environment_reported(&env) {
            continue;
        }

        let _ = resolve_environment(&pipenv_locator, env, &mut dispatcher)
            || resolve_environment(&virtualenvwrapper_locator, env, &mut dispatcher)
            || resolve_environment(&venv_locator, env, &mut dispatcher)
            || resolve_environment(&virtualenv_locator, env, &mut dispatcher);
    }

    // Step 3: Finally find in the current PATH variable
    find_environments(&path_locator, &mut dispatcher);

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

fn resolve_environment(
    locator: &dyn Locator,
    env: &PythonEnv,
    dispatcher: &mut JsonRpcDispatcher,
) -> bool {
    if let Some(env) = locator.resolve(env) {
        dispatcher.report_environment(env);
        return true;
    }
    false
}

fn find_environments(locator: &dyn Locator, dispatcher: &mut JsonRpcDispatcher) -> Option<()> {
    match locator.find()? {
        locator::LocatorResult::Environments(envs) => envs
            .iter()
            .for_each(|e| dispatcher.report_environment(e.clone())),
        locator::LocatorResult::Managers(items) => items
            .iter()
            .for_each(|m| dispatcher.report_environment_manager(m.clone())),
    }
    Some(())
}
