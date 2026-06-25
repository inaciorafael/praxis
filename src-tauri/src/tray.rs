use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};

const OPEN_MENU_ID: &str = "praxis_open";
const QUIT_MENU_ID: &str = "praxis_quit";
const APP_ICON_BYTES: &[u8] = include_bytes!("../icons/icon.png");

pub struct AppLifecycle {
    is_quitting: AtomicBool,
}

impl AppLifecycle {
    pub fn new() -> Self {
        Self {
            is_quitting: AtomicBool::new(false),
        }
    }

    pub fn is_quitting(&self) -> bool {
        self.is_quitting.load(Ordering::SeqCst)
    }

    pub fn request_quit(&self) {
        self.is_quitting.store(true, Ordering::SeqCst);
    }
}

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, OPEN_MENU_ID, "Abrir Praxis", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Praxis");

    tray = tray.icon(Image::from_bytes(APP_ICON_BYTES)?);

    tray.on_menu_event(|app, event| match event.id().as_ref() {
        OPEN_MENU_ID => show_main_window(app),
        QUIT_MENU_ID => quit_app(app),
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            show_main_window(tray.app_handle());
        }
    })
    .build(app)?;

    Ok(())
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn quit_app(app: &AppHandle) {
    app.state::<AppLifecycle>().request_quit();
    app.exit(0);
}
