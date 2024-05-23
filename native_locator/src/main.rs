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
mod windows_registry;
mod windows_store;

fn main() {
    let environment = EnvironmentApi {};
    initialize_logger(LevelFilter::Trace);

    log::info!("Starting Native Locator");
    let now = SystemTime::now();
    let mut dispatcher = create_dispatcher();

    let virtualenv_locator = virtualenv::VirtualEnv::new();
    let venv_locator = venv::Venv::new();
    let mut virtualenvwrapper = virtualenvwrapper::VirtualEnvWrapper::with(&environment);
    let pipenv_locator = pipenv::PipEnv::new();
    let mut path_locator = common_python::PythonOnPath::with(&environment);
    let mut conda_locator = conda::Conda::with(&environment);

    #[cfg(unix)]
    let mut homebrew_locator = homebrew::Homebrew::with(&environment);
    #[cfg(windows)]
    let mut windows_store = windows_store::WindowsStore::with(&environment);
    #[cfg(windows)]
    let mut windows_registry = windows_registry::WindowsRegistry::with(&mut conda_locator);

    // Step 1: These environments take precedence over all others.
    // As they are very specific and guaranteed to be specific type.
    #[cfg(windows)]
    find_environments(&mut windows_store, &mut dispatcher);
    #[cfg(windows)]
    find_environments(&mut windows_registry, &mut dispatcher);
    let mut pyenv_locator = pyenv::PyEnv::with(&environment, &mut conda_locator);
    find_environments(&mut virtualenvwrapper, &mut dispatcher);
    find_environments(&mut pyenv_locator, &mut dispatcher);
    #[cfg(unix)]
    find_environments(&mut homebrew_locator, &mut dispatcher);
    find_environments(&mut conda_locator, &mut dispatcher);

    // Step 2: Search in some global locations for virtual envs.
    for env in list_global_virtual_envs(&environment).iter() {
        if dispatcher.was_environment_reported(&env) {
            continue;
        }

        // First must be homebrew, as it is the most specific and supports symlinks
        #[cfg(unix)]
        let homebrew_result = resolve_environment(&homebrew_locator, env, &mut dispatcher);
        #[cfg(unix)]
        if homebrew_result {
            continue;
        }

        let _ = // Pipeenv before virtualenvwrapper as it is more specific.
            // Because pipenv environments are also virtualenvwrapper environments.
            resolve_environment(&pipenv_locator, env, &mut dispatcher)
            // Before venv, as all venvs are also virtualenvwrapper environments.
            || resolve_environment(&virtualenvwrapper, env, &mut dispatcher)
            // Before virtualenv as this is more specific.
            // All venvs are also virtualenvs environments.
            || resolve_environment(&venv_locator, env, &mut dispatcher)
            || resolve_environment(&virtualenv_locator, env, &mut dispatcher);
    }

    // Step 3: Finally find in the current PATH variable
    find_environments(&mut path_locator, &mut dispatcher);

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

fn find_environments(locator: &mut dyn Locator, dispatcher: &mut JsonRpcDispatcher) -> Option<()> {
    if let Some(result) = locator.find() {
        result
            .environments
            .iter()
            .for_each(|e| dispatcher.report_environment(e.clone()));
        result
            .managers
            .iter()
            .for_each(|m| dispatcher.report_environment_manager(m.clone()));
    }
    Some(())
}
