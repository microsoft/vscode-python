// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use global_virtualenvs::list_global_virtual_envs;
use known::EnvironmentApi;
use locator::{Locator, LocatorResult};
use messaging::{create_dispatcher, JsonRpcDispatcher, MessageDispatcher};
use std::thread::{self, JoinHandle};
use utils::PythonEnv;

pub mod common_python;
pub mod conda;
pub mod global_virtualenvs;
pub mod homebrew;
pub mod known;
pub mod locator;
pub mod logging;
pub mod messaging;
pub mod pipenv;
pub mod pyenv;
pub mod utils;
pub mod venv;
pub mod virtualenv;
pub mod virtualenvwrapper;
pub mod windows_registry;
pub mod windows_store;

pub fn find_and_report_envs() {
    let mut dispatcher: JsonRpcDispatcher = create_dispatcher();

    // 1. Find using known global locators.
    find_using_global_finders(&mut dispatcher);

    // Step 2: Search in some global locations for virtual envs.
    find_in_global_virtual_env_dirs(&mut dispatcher);

    // Step 3: Finally find in the current PATH variable
    let environment = EnvironmentApi::new();
    let mut path_locator = common_python::PythonOnPath::with(&environment);
    report_result(path_locator.find(), &mut dispatcher)
}

fn find_using_global_finders(dispatcher: &mut JsonRpcDispatcher) {
    // Step 1: These environments take precedence over all others.
    // As they are very specific and guaranteed to be specific type.
    #[cfg(windows)]
    fn find() -> Vec<JoinHandle<std::option::Option<LocatorResult>>> {
        // The order matters,
        // Windows store can sometimes get detected via registry locator (but we want to avoid that),
        //  difficult to repro, but we have see this on Karthiks machine
        // Windows registry can contain conda envs (e.g. installing Ananconda will result in registry entries).
        // Conda is best done last, as Windows Registry and Pyenv can also contain conda envs,
        // Thus lets leave the generic conda locator to last to find all remaining conda envs.
        // pyenv can be treated as a virtualenvwrapper environment, hence virtualenvwrapper needs to be detected first
        vec![
            // 1. windows store
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                let mut windows_store = windows_store::WindowsStore::with(&environment);
                windows_store.find()
            }),
            // 2. windows registry
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                let mut conda_locator = conda::Conda::with(&environment);
                windows_registry::WindowsRegistry::with(&mut conda_locator).find()
            }),
            // 3. virtualenvwrapper
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                virtualenvwrapper::VirtualEnvWrapper::with(&environment).find()
            }),
            // 4. pyenv
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                let mut conda_locator = conda::Conda::with(&environment);
                pyenv::PyEnv::with(&environment, &mut conda_locator).find()
            }),
            // 5. conda
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                conda::Conda::with(&environment).find()
            }),
        ]
    }

    #[cfg(unix)]
    fn find() -> Vec<JoinHandle<std::option::Option<LocatorResult>>> {
        // The order matters,
        // pyenv can be treated as a virtualenvwrapper environment, hence virtualenvwrapper needs to be detected first
        // Homebrew can happen anytime
        // Conda is best done last, as pyenv can also contain conda envs,
        // Thus lets leave the generic conda locator to last to find all remaining conda envs.

        vec![
            // 1. virtualenvwrapper
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                virtualenvwrapper::VirtualEnvWrapper::with(&environment).find()
            }),
            // 2. pyenv
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                let mut conda_locator = conda::Conda::with(&environment);
                pyenv::PyEnv::with(&environment, &mut conda_locator).find()
            }),
            // 3. homebrew
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                homebrew::Homebrew::with(&environment).find()
            }),
            // 4. conda
            thread::spawn(|| {
                let environment = EnvironmentApi::new();
                conda::Conda::with(&environment).find()
            }),
        ]
    }

    for handle in find() {
        if let Ok(result) = handle.join() {
            report_result(result, dispatcher);
        } else {
            log::error!("Error getting result from thread.");
        }
    }
}

fn find_in_global_virtual_env_dirs(dispatcher: &mut JsonRpcDispatcher) -> Option<LocatorResult> {
    // Step 1: These environments take precedence over all others.
    // As they are very specific and guaranteed to be specific type.

    let environment = EnvironmentApi::new();
    let virtualenv_locator = virtualenv::VirtualEnv::new();
    let venv_locator = venv::Venv::new();
    let virtualenvwrapper = virtualenvwrapper::VirtualEnvWrapper::with(&environment);
    let pipenv_locator = pipenv::PipEnv::new();
    #[cfg(unix)]
    let homebrew_locator = homebrew::Homebrew::with(&environment);

    let venv_type_locators = vec![
        Box::new(pipenv_locator) as Box<dyn Locator>,
        Box::new(virtualenvwrapper) as Box<dyn Locator>,
        Box::new(venv_locator) as Box<dyn Locator>,
        Box::new(virtualenv_locator) as Box<dyn Locator>,
    ];

    // Step 2: Search in some global locations for virtual envs.
    for env in list_global_virtual_envs(&environment) {
        if dispatcher.was_environment_reported(&env) {
            continue;
        }

        // 1. First must be homebrew, as it is the most specific and supports symlinks
        #[cfg(unix)]
        if resolve_and_report_environment(&homebrew_locator, &env, dispatcher) {
            continue;
        }

        // 3. Finally Check if these are some kind of virtual env or pipenv.
        // Pipeenv before virtualenvwrapper as it is more specific.
        // Because pipenv environments are also virtualenvwrapper environments.
        // Before venv, as all venvs are also virtualenvwrapper environments.
        // Before virtualenv as this is more specific.
        // All venvs are also virtualenvs environments.
        for locator in &venv_type_locators {
            if resolve_and_report_environment(locator.as_ref(), &env, dispatcher) {
                break;
            }
        }
    }
    None
}

fn resolve_and_report_environment(
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

fn report_result(result: Option<LocatorResult>, dispatcher: &mut JsonRpcDispatcher) {
    if let Some(result) = result {
        result
            .environments
            .iter()
            .for_each(|e| dispatcher.report_environment(e.clone()));
        result
            .managers
            .iter()
            .for_each(|m| dispatcher.report_environment_manager(m.clone()));
    }
}
