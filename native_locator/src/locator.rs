// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{messaging::MessageDispatcher, utils::PythonEnv};
use std::path::PathBuf;

pub trait Locator {
    /**
     * Whether the given Python executable is known to this locator.
     */
    fn is_known(&self, python_executable: &PathBuf) -> bool;
    /**
     * Track the given Python executable if it is compatible with the environments supported by this locator.
     * This way, when report is called, the environment passed here will be reported as a known environment by this locator.
     * Returns true if the environment was tracked, false otherwise.
     */
    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool;
    /**
     * Finds all environments managed by this locator.
     */
    fn gather(&mut self) -> Option<()>;
    /**
     * Report all of the tracked environments and managers.
     */
    fn report(&self, reporter: &mut dyn MessageDispatcher);
}
