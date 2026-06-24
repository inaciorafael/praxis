// Praxis is a desktop GUI. Native reminder launches must never open a console window.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    praxis_lib::run()
}
