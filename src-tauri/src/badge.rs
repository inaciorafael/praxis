use std::{fs, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{image::Image, AppHandle, Manager, WebviewWindow};

const BADGE_FILE: &str = "badge-count.json";
const MAIN_WINDOW: &str = "main";

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize)]
pub struct BadgeState {
    pub count: u32,
}

pub struct BadgeStore(pub Mutex<BadgeState>);

#[derive(Debug, Serialize)]
pub struct BadgeSnapshot {
    pub count: u32,
    pub visible: bool,
    pub platform: &'static str,
    pub native_badge_supported: bool,
    pub persists_when_closed: bool,
}

#[tauri::command]
pub fn get_badge_count(state: tauri::State<'_, BadgeStore>) -> BadgeSnapshot {
    snapshot(state.0.lock().map(|state| state.count).unwrap_or_default())
}

#[tauri::command]
pub fn set_badge_count(
    app: AppHandle,
    state: tauri::State<'_, BadgeStore>,
    count: u32,
) -> Result<BadgeSnapshot, String> {
    let count = count.min(999);
    persist_badge_count(&app, count)?;

    if let Ok(mut state) = state.0.lock() {
        state.count = count;
    }

    let _ = apply_badge_count(&app, count);
    Ok(snapshot(count))
}

#[tauri::command]
pub fn clear_badge_count(
    app: AppHandle,
    state: tauri::State<'_, BadgeStore>,
) -> Result<BadgeSnapshot, String> {
    set_badge_count(app, state, 0)
}

pub fn load_badge_count(app: &AppHandle) -> u32 {
    let Ok(path) = badge_file_path(app) else {
        return 0;
    };

    let Ok(content) = fs::read_to_string(path) else {
        return 0;
    };

    serde_json::from_str::<BadgeState>(&content)
        .map(|state| state.count.min(999))
        .unwrap_or_default()
}

pub fn apply_badge_count(app: &AppHandle, count: u32) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return Ok(());
    };

    apply_window_badge(&window, count)
}

fn apply_window_badge(window: &WebviewWindow, count: u32) -> Result<(), String> {
    let badge_count = (count > 0).then_some(i64::from(count));
    let _ = window.set_badge_count(badge_count);

    #[cfg(target_os = "windows")]
    {
        let icon = (count > 0).then(|| create_windows_overlay_icon(count));
        window
            .set_overlay_icon(icon)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn persist_badge_count(app: &AppHandle, count: u32) -> Result<(), String> {
    let path = badge_file_path(app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let payload =
        serde_json::to_string_pretty(&BadgeState { count }).map_err(|error| error.to_string())?;

    fs::write(path, payload).map_err(|error| error.to_string())
}

fn badge_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(BADGE_FILE))
        .map_err(|error| error.to_string())
}

fn snapshot(count: u32) -> BadgeSnapshot {
    BadgeSnapshot {
        count,
        visible: count > 0,
        platform: std::env::consts::OS,
        native_badge_supported: cfg!(any(
            target_os = "macos",
            target_os = "linux",
            target_os = "ios"
        )),
        persists_when_closed: cfg!(any(target_os = "macos", target_os = "ios")),
    }
}

#[cfg(target_os = "windows")]
fn create_windows_overlay_icon(count: u32) -> Image<'static> {
    const SIZE: u32 = 32;
    let label = if count > 99 {
        "99+".to_string()
    } else {
        count.to_string()
    };

    let mut pixels = vec![0_u8; (SIZE * SIZE * 4) as usize];
    draw_circle(&mut pixels, SIZE, 16.0, 16.0, 15.0, [220, 38, 38, 255]);
    draw_label(&mut pixels, SIZE, &label);

    Image::new_owned(pixels, SIZE, SIZE)
}

#[cfg(target_os = "windows")]
fn draw_circle(pixels: &mut [u8], size: u32, cx: f32, cy: f32, radius: f32, color: [u8; 4]) {
    for y in 0..size {
        for x in 0..size {
            let distance = ((x as f32 - cx).powi(2) + (y as f32 - cy).powi(2)).sqrt();

            if distance <= radius {
                set_pixel(pixels, size, x, y, color);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn draw_label(pixels: &mut [u8], size: u32, label: &str) {
    let scale = if label.len() > 2 { 2 } else { 3 };
    let digit_width = 3 * scale;
    let digit_height = 5 * scale;
    let gap = scale;
    let total_width = (label.len() as u32 * digit_width) + ((label.len() as u32 - 1) * gap);
    let mut cursor_x = ((size - total_width) / 2) as i32;
    let y = ((size - digit_height) / 2) as i32 + 1;

    for character in label.chars() {
        draw_character(pixels, size, character, cursor_x, y, scale as i32);
        cursor_x += (digit_width + gap) as i32;
    }
}

#[cfg(target_os = "windows")]
fn draw_character(pixels: &mut [u8], size: u32, character: char, x: i32, y: i32, scale: i32) {
    let glyph = glyph(character);

    for (row_index, row) in glyph.iter().enumerate() {
        for (column_index, cell) in row.chars().enumerate() {
            if cell != '1' {
                continue;
            }

            for offset_y in 0..scale {
                for offset_x in 0..scale {
                    let pixel_x = x + column_index as i32 * scale + offset_x;
                    let pixel_y = y + row_index as i32 * scale + offset_y;

                    if pixel_x >= 0 && pixel_y >= 0 {
                        set_pixel(
                            pixels,
                            size,
                            pixel_x as u32,
                            pixel_y as u32,
                            [255, 255, 255, 255],
                        );
                    }
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn glyph(character: char) -> [&'static str; 5] {
    match character {
        '0' => ["111", "101", "101", "101", "111"],
        '1' => ["010", "110", "010", "010", "111"],
        '2' => ["111", "001", "111", "100", "111"],
        '3' => ["111", "001", "111", "001", "111"],
        '4' => ["101", "101", "111", "001", "001"],
        '5' => ["111", "100", "111", "001", "111"],
        '6' => ["111", "100", "111", "101", "111"],
        '7' => ["111", "001", "010", "010", "010"],
        '8' => ["111", "101", "111", "101", "111"],
        '9' => ["111", "101", "111", "001", "111"],
        '+' => ["000", "010", "111", "010", "000"],
        _ => ["111", "101", "101", "101", "111"],
    }
}

#[cfg(target_os = "windows")]
fn set_pixel(pixels: &mut [u8], size: u32, x: u32, y: u32, color: [u8; 4]) {
    if x >= size || y >= size {
        return;
    }

    let index = ((y * size + x) * 4) as usize;
    pixels[index..index + 4].copy_from_slice(&color);
}
