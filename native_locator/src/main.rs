
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

pub use known::*;
pub use conda::*;
pub use messaging::*;
mod conda;
mod known;
mod messaging;

fn main() {
    conda::find_and_report_conda_envs();
    messaging::send_message(messaging::ExitMessage::new());
}
