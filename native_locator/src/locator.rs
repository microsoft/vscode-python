// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    messaging::{EnvManager, PythonEnvironment},
    utils::PythonEnv,
};

#[derive(Debug)]
pub struct LocatorResult {
    pub managers: Vec<EnvManager>,
    pub environments: Vec<PythonEnvironment>,
}

pub trait Locator {
    /**
     * Given a Python environment, this will convert it to a PythonEnvironment that can be supported by this locator.
     * If an environment is not supported by this locator, this will return None.
     *
     * I.e. use this to test whether an environment is of a specific type.
     */
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment>;
    /**
     * Finds all environments specific to this locator.
     */
    fn find(&self) -> Option<LocatorResult>;
}
