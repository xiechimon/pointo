//! The welcome window in GPUI, drawn from `onboarding::Flow::view()` like the SwiftUI window in
//! `helper/Onboarding.swift` (same screens, copy, sizes and palette), and driven by the same JSON
//! messages: `state`, `request`, `open-settings`, `hide`, `show` and `close`. Its buttons report
//! the same actions (`continue`, `back`, `later`, `close`, `grant:<permission>`).
//!
//! Windows uses it in process (`onboarding::Session`); macOS still runs the SwiftUI window in
//! `pointo-helper onboarding`.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use gpui::{
    AnyElement, App, Bounds, BoxShadow, Context, Div, FontWeight, Image, ImageFormat,
    InteractiveElement, IntoElement, ParentElement, Render, SharedString, Stateful,
    StatefulInteractiveElement, Styled, Transformation, Window, WindowBackgroundAppearance,
    WindowBounds, WindowControlArea, WindowKind, WindowOptions, div, hsla, img, linear_color_stop,
    linear_gradient, point, prelude::*, px, radians, relative, rgb, rgba, size, svg,
};
use serde::Deserialize;

use crate::onboarding::{Event, Permission, Status, Step};

const CANVAS: u32 = 0x161616;
const SURFACE: u32 = 0x1d1d1d;
const RAISED: u32 = 0x252525;
const LINE: u32 = 0xffffff17;
const TEXT: u32 = 0xf2f2f2;
const SOFT: u32 = 0xd0d0d0;
const MUTED: u32 = 0x969696;
const INK: u32 = 0x3b5cf6;
const POSITIVE: u32 = 0x69d89f;
const WIDTH: f32 = 620.0;
/// The Windows caption strip (drag area and close button) above the page.
const CAPTION_H: f32 = if cfg!(target_os = "windows") {
    32.0
} else {
    0.0
};

type Events = Arc<dyn Fn(Event) + Send + Sync>;

struct Request {
    commands: flume::Receiver<serde_json::Value>,
    shortcut: String,
    events: Events,
}

static PENDING: Mutex<Vec<Request>> = Mutex::new(Vec::new());

/// Queues a welcome window; the UI loop opens it (`poll`).
pub fn request_open(
    commands: flume::Receiver<serde_json::Value>,
    shortcut: String,
    events: Events,
) {
    PENDING
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .push(Request {
            commands,
            shortcut,
            events,
        });
}

/// Opens queued welcome windows. Called from the UI loop.
pub fn poll(cx: &mut App) {
    let requests = std::mem::take(
        &mut *PENDING
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner),
    );
    for request in requests {
        open(request, cx);
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct RowState {
    permission: Permission,
    status: Status,
    #[serde(default)]
    requested: bool,
    #[serde(default)]
    required: bool,
    #[serde(default)]
    relaunch: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ViewState {
    step: Step,
    index: usize,
    count: usize,
    rows: Vec<RowState>,
    ready: bool,
    fix: bool,
}

/// Permissions this platform asks for. Windows has no Screen Recording, Input Monitoring or
/// Accessibility switch, so those rows never show there.
fn shown_on_this_platform(permission: Permission) -> bool {
    !cfg!(target_os = "windows")
        || matches!(permission, Permission::Microphone | Permission::Camera)
}

impl ViewState {
    fn rows(&self) -> Vec<&RowState> {
        self.rows
            .iter()
            .filter(|row| shown_on_this_platform(row.permission))
            .collect()
    }

    fn height(&self) -> f32 {
        let body = if self.fix {
            318.0 + 58.0 * self.rows().len().max(1) as f32
        } else {
            500.0
        };
        body + CAPTION_H
    }
}

fn open(request: Request, cx: &mut App) {
    for handle in cx.windows() {
        if handle.downcast::<OnboardingWindow>().is_some() {
            let _ = handle.update(cx, |_, window, _| window.remove_window());
        }
    }
    // `Session::open` sends the first state right away, so the window opens at its size.
    let mut first = None;
    let mut early = Vec::new();
    while let Ok(message) = request.commands.try_recv() {
        if first.is_none() && message["type"] == "state" {
            first = serde_json::from_value::<ViewState>(message.clone()).ok();
        }
        early.push(message);
    }
    let height = first.as_ref().map_or(500.0 + CAPTION_H, ViewState::height);
    let bounds = Bounds::centered(None, size(px(WIDTH), px(height)), cx);
    let Request {
        commands,
        shortcut,
        events,
    } = request;
    let close_events = Arc::clone(&events);
    let opened = cx.open_window(
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            titlebar: Some(gpui::TitlebarOptions {
                title: Some("欢迎使用 Pointo".into()),
                appears_transparent: true,
                traffic_light_position: Some(point(px(14.0), px(14.0))),
            }),
            focus: true,
            show: true,
            kind: WindowKind::Normal,
            is_movable: true,
            is_resizable: false,
            is_minimizable: false,
            window_background: WindowBackgroundAppearance::Opaque,
            app_id: Some("dev.xiechimon.pointo".into()),
            ..Default::default()
        },
        move |window, cx| {
            #[cfg(target_os = "windows")]
            crate::ui::set_app_icon(window);
            window.on_window_should_close(cx, move |_, _| {
                close_events(Event::Action("close".into()));
                close_events(Event::Exited);
                true
            });
            cx.new(|cx| {
                let mut view = OnboardingWindow {
                    state: None,
                    shortcut,
                    events,
                    step_since: Instant::now(),
                    forward: true,
                    opened: Instant::now(),
                };
                for message in early {
                    view.handle(message, None);
                }
                cx.spawn_in(window, async move |this, cx| {
                    loop {
                        cx.background_executor()
                            .timer(Duration::from_millis(16))
                            .await;
                        let mut messages = Vec::new();
                        while let Ok(message) = commands.try_recv() {
                            messages.push(message);
                        }
                        let disconnected = commands.is_disconnected();
                        let arrived = !messages.is_empty();
                        let alive = this
                            .update_in(cx, |view: &mut OnboardingWindow, window, cx| {
                                for message in messages {
                                    if !view.handle(message, Some(window)) {
                                        window.remove_window();
                                        return false;
                                    }
                                }
                                if disconnected {
                                    window.remove_window();
                                    return false;
                                }
                                // A new view (a grant that arrived later, say) repaints too.
                                if arrived || view.animating() {
                                    cx.notify();
                                }
                                true
                            })
                            .unwrap_or(false);
                        if !alive {
                            break;
                        }
                    }
                })
                .detach();
                view
            })
        },
    );
    if opened.is_err() {
        crate::capture::scrawl_log("onboarding: the welcome window failed to open");
    }
}

pub struct OnboardingWindow {
    state: Option<ViewState>,
    shortcut: String,
    events: Events,
    step_since: Instant,
    forward: bool,
    opened: Instant,
}

impl OnboardingWindow {
    /// Applies one message from the session; `false` when the window should close.
    fn handle(&mut self, message: serde_json::Value, window: Option<&mut Window>) -> bool {
        match message["type"].as_str().unwrap_or_default() {
            "state" => {
                let Ok(next) = serde_json::from_value::<ViewState>(message).inspect_err(|error| {
                    crate::capture::scrawl_log(format!(
                        "onboarding: could not decode state: {error}"
                    ));
                }) else {
                    return true;
                };
                if let Some(ref old) = self.state
                    && old.step != next.step
                {
                    self.forward = next.index >= old.index;
                    self.step_since = Instant::now();
                }
                if let Some(window) = window
                    && self
                        .state
                        .as_ref()
                        .is_none_or(|old| old.height() != next.height())
                {
                    window.resize(size(px(WIDTH), px(next.height())));
                }
                self.state = Some(next);
            }
            "request" | "open-settings" => {
                if let Some(permission) = message["permission"]
                    .as_str()
                    .and_then(|p| serde_json::from_value(p.into()).ok())
                {
                    open_settings(permission);
                }
            }
            "hide" => set_visible(window, false),
            "show" => set_visible(window, true),
            "close" => return false,
            _ => {}
        }
        true
    }

    fn animating(&self) -> bool {
        let page = self.step_since.elapsed() < Duration::from_millis(400);
        let looping = self.state.as_ref().is_some_and(|s| {
            matches!(s.step, Step::Welcome | Step::TryIt)
                || s.rows
                    .iter()
                    .any(|r| r.requested && r.status != Status::Granted)
        });
        page || looping
    }

    fn act(&self, action: &str) {
        (self.events)(Event::Action(action.to_owned()));
    }
}

#[cfg(target_os = "windows")]
fn open_settings(permission: Permission) {
    crate::win::privacy::open_settings(permission);
}

#[cfg(not(target_os = "windows"))]
fn open_settings(_permission: Permission) {}

#[cfg(target_os = "windows")]
fn set_visible(window: Option<&mut Window>, visible: bool) {
    use windows::Win32::UI::WindowsAndMessaging::{SW_HIDE, SW_SHOW, ShowWindow};
    if let Some(hwnd) = window.and_then(|w| crate::ui::hwnd_of(w)) {
        let _ = unsafe { ShowWindow(hwnd, if visible { SW_SHOW } else { SW_HIDE }) };
    }
}

#[cfg(not(target_os = "windows"))]
fn set_visible(_window: Option<&mut Window>, _visible: bool) {}

use crate::ui::ease_out_cubic;

fn number_word(n: usize) -> String {
    ["零", "一", "两", "三", "四", "五"]
        .get(n)
        .map_or_else(|| n.to_string(), |w| (*w).to_owned())
}

// MARK: Building blocks

fn keycap(label: &str, lit: bool, size: f32) -> Div {
    let wide = label.chars().count() > 1;
    div()
        .flex_none()
        .min_w(px(size))
        .h(px(size))
        .when(wide, |d| d.px(px(8.0)))
        .flex()
        .items_center()
        .justify_center()
        .rounded(px(size * 0.24))
        .bg(linear_gradient(
            180.0,
            linear_color_stop(hsla(0.0, 0.0, 1.0, 0.13), 0.0),
            linear_color_stop(hsla(0.0, 0.0, 1.0, 0.06), 1.0),
        ))
        .border_1()
        .border_color(if lit {
            rgba(0x3b5cf6b3)
        } else {
            rgba(0xffffff24)
        })
        .shadow(vec![BoxShadow {
            color: hsla(0.0, 0.0, 0.0, 0.45),
            offset: point(px(0.0), px(2.0)),
            blur_radius: px(1.5),
            spread_radius: px(0.0),
        }])
        .text_size(px(size * 0.44))
        .font_weight(FontWeight::MEDIUM)
        .text_color(rgb(if lit { INK } else { TEXT }))
        .child(label.to_owned())
}

/// One keycap per key; with `lit_mods`, every key but the last is lit.
fn keycaps(label: &str, lit_mods: bool, size: f32) -> Div {
    let keys = crate::capture::shortcut_keys(label);
    let last = keys.len().saturating_sub(1);
    div().flex().items_center().gap(px(size * 0.18)).children(
        keys.iter()
            .enumerate()
            .map(|(i, key)| keycap(key, lit_mods && i < last, size)),
    )
}

fn primary_button(id: &'static str, title: &str, enabled: bool) -> Stateful<Div> {
    div()
        .id(id)
        .min_w(px(180.0))
        .h(px(34.0))
        .px(px(22.0))
        .flex()
        .items_center()
        .justify_center()
        .rounded(px(9.0))
        .bg(rgb(if enabled { INK } else { RAISED }))
        .border_1()
        .border_color(if enabled {
            rgba(0xffffff29)
        } else {
            rgba(0xffffff14)
        })
        .when(enabled, |d| {
            d.shadow(vec![BoxShadow {
                color: ink_glow(0.35),
                offset: point(px(0.0), px(3.0)),
                blur_radius: px(10.0),
                spread_radius: px(0.0),
            }])
            .cursor_pointer()
            .hover(|s| s.opacity(0.92))
        })
        .when(!enabled, |d| d.opacity(0.55))
        .text_size(px(13.0))
        .font_weight(FontWeight::SEMIBOLD)
        .text_color(rgb(0xffffff))
        .child(title.to_owned())
}

fn quiet_button(id: &'static str, title: &str) -> Stateful<Div> {
    div()
        .id(id)
        .px(px(10.0))
        .py(px(4.0))
        .rounded(px(6.0))
        .cursor_pointer()
        .hover(|s| s.text_color(rgb(SOFT)))
        .text_size(px(12.0))
        .font_weight(FontWeight::MEDIUM)
        .text_color(rgb(MUTED))
        .child(title.to_owned())
}

fn row_button(id: SharedString, title: &str) -> Stateful<Div> {
    div()
        .id(id)
        .h(px(26.0))
        .px(px(12.0))
        .flex()
        .items_center()
        .rounded_full()
        .bg(rgba(0xffffff1a))
        .border_1()
        .border_color(rgba(0xffffff24))
        .cursor_pointer()
        .hover(|s| s.bg(rgba(0xffffff26)))
        .text_size(px(12.0))
        .font_weight(FontWeight::SEMIBOLD)
        .text_color(rgb(TEXT))
        .child(title.to_owned())
}

fn icon(path: &'static str, size: f32, color: u32) -> gpui::Svg {
    svg()
        .path(path)
        .size(px(size))
        .flex_none()
        .text_color(rgb(color))
}

fn spinner(phase: f32) -> gpui::Svg {
    icon(crate::icons::SPINNER, 11.0, MUTED).with_transformation(Transformation::rotate(radians(
        phase / 0.9 * std::f32::consts::TAU,
    )))
}

// MARK: Pages

impl OnboardingWindow {
    fn labels(&self) -> (String, String, String) {
        let paste = crate::capture::system_paste_label().to_owned();
        let shift = if cfg!(target_os = "windows") {
            "Shift"
        } else {
            "⇧"
        }
        .to_owned();
        (self.shortcut.clone(), paste, shift)
    }

    fn centered(&self, art: AnyElement, art_h: f32, title: &str, body: String) -> Div {
        div()
            .flex()
            .flex_col()
            .items_center()
            .pt(px(34.0))
            .child(
                div()
                    .h(px(art_h))
                    .w_full()
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(art),
            )
            .child(
                div()
                    .pt(px(18.0))
                    .text_size(px(22.0))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(rgb(TEXT))
                    .child(title.to_owned()),
            )
            .child(
                div()
                    .pt(px(10.0))
                    .max_w(px(440.0))
                    .text_center()
                    .text_size(px(13.5))
                    .line_height(px(13.5 * 1.25 + 3.0))
                    .text_color(rgba(0xd0d0d0d9))
                    .child(body),
            )
    }

    fn welcome_art(&self, phase: f32) -> AnyElement {
        let bob = -3.0 * (phase / 4.0 * std::f32::consts::TAU).sin();
        div()
            .relative()
            .size(px(150.0))
            .flex()
            .items_center()
            .justify_center()
            .child(
                div()
                    .absolute()
                    .size(px(150.0))
                    .rounded_full()
                    .bg(rgba(0x3b5cf614))
                    .shadow(vec![BoxShadow {
                        color: ink_glow(0.18),
                        offset: point(px(0.0), px(0.0)),
                        blur_radius: px(46.0),
                        spread_radius: px(0.0),
                    }]),
            )
            .child(
                div().relative().top(px(bob)).child(
                    img(Arc::new(Image::from_bytes(
                        ImageFormat::Png,
                        include_bytes!("../assets/app-icon.png").to_vec(),
                    )))
                    .size(px(128.0)),
                ),
            )
            .into_any_element()
    }

    fn try_art(&self, phase: f32) -> AnyElement {
        let t = (phase / 2.2).fract();
        div()
            .relative()
            .w(px(260.0))
            .h(px(146.0))
            .flex()
            .items_center()
            .justify_center()
            .child(
                div()
                    .absolute()
                    .w(px(200.0 + 60.0 * t))
                    .h(px(86.0 + 60.0 * t))
                    .rounded(px(22.0))
                    .border_2()
                    .border_color(ink_glow(0.55 * (1.0 - t))),
            )
            .child(keycaps(&self.shortcut, true, 52.0))
            .into_any_element()
    }

    fn done_art(&self) -> AnyElement {
        let appear = ease_out_cubic(self.step_since.elapsed().as_secs_f32() / 0.3);
        div()
            .relative()
            .size(px(150.0))
            .flex()
            .items_center()
            .justify_center()
            .opacity(appear)
            .child(
                div()
                    .absolute()
                    .size(px(150.0))
                    .rounded_full()
                    .bg(rgba(0x69d89f14))
                    .shadow(vec![BoxShadow {
                        color: hsla(150.0 / 360.0, 0.58, 0.63, 0.16),
                        offset: point(px(0.0), px(0.0)),
                        blur_radius: px(30.0),
                        spread_radius: px(0.0),
                    }]),
            )
            .child(
                div()
                    .size(px(104.0 * (0.96 + 0.04 * appear)))
                    .rounded_full()
                    .bg(rgba(0x69d89f24))
                    .border_1()
                    .border_color(rgba(0x69d89f8c))
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(icon(crate::icons::CHECK, 42.0, POSITIVE)),
            )
            .into_any_element()
    }

    fn how_it_works(&self) -> Div {
        let (s, paste, shift) = self.labels();
        let pick = if cfg!(target_os = "windows") {
            "窗口或区域"
        } else {
            "窗口、区域或 iPhone"
        };
        let row = |keys: Div, text: String| {
            div()
                .flex()
                .items_center()
                .gap(px(16.0))
                .px(px(16.0))
                .py(px(14.0))
                .child(
                    div()
                        .w(px(132.0))
                        .flex_none()
                        .flex()
                        .justify_center()
                        .child(keys),
                )
                .child(
                    div()
                        .flex_1()
                        .min_w_0()
                        .text_size(px(13.5))
                        .line_height(px(13.5 * 1.25 + 2.5))
                        .text_color(rgba(0xd0d0d0e6))
                        .child(text),
                )
        };
        let divider = || div().ml(px(16.0)).h(px(1.0)).bg(rgba(LINE));
        div()
            .flex()
            .flex_col()
            .pt(px(44.0))
            .child(
                div()
                    .text_size(px(22.0))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(rgb(TEXT))
                    .text_center()
                    .child("Pointo 怎么用"),
            )
            .child(
                div()
                    .mt(px(24.0))
                    .rounded(px(12.0))
                    .bg(rgb(SURFACE))
                    .border_1()
                    .border_color(rgba(LINE))
                    .flex()
                    .flex_col()
                    .child(row(
                        keycaps(&s, false, 26.0),
                        // The keycaps on the left already name the shortcut. Spelled out here,
                        // "Alt+Shift+S" would wrap at a `+` (GPUI breaks lines at any non-word char).
                        format!("轻按：录制指针所在的屏幕。按住：选择{pick}。"),
                    ))
                    .child(divider())
                    .child(row(
                        keycap(&shift, true, 26.0),
                        format!(
                            "边操作边说话；按住 {shift} 拖动，就能在屏幕上圈出重点。Pointo 也会记录你的点击。"
                        ),
                    ))
                    .child(divider())
                    .child(row(
                        keycaps(&paste, false, 26.0),
                        "再按一次快捷键结束。录制已在剪贴板里，直接粘贴给 AI 代理。".to_owned(),
                    )),
            )
    }

    fn permission_row(&self, row: &RowState, phase: f32, cx: &mut Context<Self>) -> Div {
        let (glyph, name, why) = match row.permission {
            Permission::ScreenRecording => (
                crate::icons::SCREEN,
                "屏幕与系统录音",
                "录制时看到你的屏幕".to_owned(),
            ),
            Permission::Microphone => (
                crate::icons::MIC,
                "麦克风",
                "录制时听到你说的话".to_owned(),
            ),
            Permission::InputMonitoring => (
                crate::icons::CLICK,
                "输入监控",
                "在所有应用里记录你的点击和快捷键".to_owned(),
            ),
            Permission::Accessibility => (
                crate::icons::PERSON,
                "辅助功能",
                format!(
                    "用 {1} 时替你按下 {0}",
                    crate::capture::system_paste_label(),
                    crate::settings::paste_label()
                ),
            ),
            Permission::Camera => (
                crate::icons::IPHONE,
                "摄像头",
                "显示并录制数据线连接的 iPhone".to_owned(),
            ),
        };
        let granted = row.status == Status::Granted;
        let denied = row.status == Status::Denied;
        let state = self.state.as_ref();
        let optional = !row.required && !state.is_some_and(|s| s.fix);
        let trailing: AnyElement = if granted && row.relaunch {
            div()
                .flex()
                .items_center()
                .gap(px(5.0))
                .child(icon(crate::icons::REOPEN, 12.0, POSITIVE))
                .child("重新打开后生效")
                .into_any_element()
        } else if granted {
            div()
                .flex()
                .items_center()
                .gap(px(5.0))
                .child(icon(crate::icons::CHECK_CIRCLE, 13.0, POSITIVE))
                .child("已允许")
                .into_any_element()
        } else {
            let events = Arc::clone(&self.events);
            let action = format!(
                "grant:{}",
                serde_json::to_value(row.permission)
                    .ok()
                    .and_then(|v| v.as_str().map(str::to_owned))
                    .unwrap_or_default()
            );
            // Windows has no prompt for desktop apps: the button always opens Settings.
            let title = if row.requested || denied || cfg!(target_os = "windows") {
                "打开设置"
            } else {
                "允许"
            };
            div()
                .flex()
                .items_center()
                .gap(px(8.0))
                .when(row.requested && !denied, |d| d.child(spinner(phase)))
                .child(
                    row_button(SharedString::from(action.clone()), title).on_click(
                        cx.listener(move |_, _, _, _| events(Event::Action(action.clone()))),
                    ),
                )
                .into_any_element()
        };
        div()
            .h(px(58.0))
            .px(px(14.0))
            .flex()
            .items_center()
            .gap(px(12.0))
            .child(
                div()
                    .size(px(32.0))
                    .flex_none()
                    .rounded_full()
                    .bg(if granted {
                        rgba(0x69d89f24)
                    } else {
                        rgba(0xffffff12)
                    })
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(icon(glyph, 14.0, if granted { POSITIVE } else { TEXT })),
            )
            .child(
                div()
                    .flex_1()
                    .min_w_0()
                    .flex()
                    .flex_col()
                    .gap(px(2.0))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap(px(6.0))
                            .text_size(px(13.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(TEXT))
                            .child(name)
                            .when(optional, |d| {
                                d.child(
                                    div()
                                        .px(px(6.0))
                                        .py(px(1.5))
                                        .rounded_full()
                                        .bg(rgba(0xffffff12))
                                        .text_size(px(10.0))
                                        .text_color(rgb(MUTED))
                                        .child("可选"),
                                )
                            }),
                    )
                    .child(div().text_size(px(12.0)).text_color(rgb(MUTED)).child(why)),
            )
            .child(
                div()
                    .flex_none()
                    .ml(px(8.0))
                    .text_size(px(12.0))
                    .font_weight(FontWeight::MEDIUM)
                    .text_color(rgb(SOFT))
                    .child(trailing),
            )
    }

    fn permissions(&self, state: &ViewState, phase: f32, cx: &mut Context<Self>) -> Div {
        let rows = state.rows();
        let windows = cfg!(target_os = "windows");
        let note = if windows {
            ""
        } else {
            "如果 macOS 提示“退出并重新打开 Pointo”，请选“稍后”；全部完成后 Pointo 会自己重新打开一次。"
        };
        let settings = if windows {
            "Windows 设置"
        } else {
            "macOS 的授权提示或系统设置"
        };
        let only = |p: Permission| rows.len() == 1 && rows[0].permission == p;
        let (title, body) = if state.fix && only(Permission::Camera) {
            (
                "摄像头，用于 iPhone".to_owned(),
                "macOS 把数据线连接的 iPhone 屏幕当作摄像头，所以 Pointo 需要摄像头权限才能显示和录制。开启后请再选一次 iPhone。".to_owned(),
            )
        } else if state.fix && only(Permission::Accessibility) {
            (
                format!("辅助功能，用于 {}", crate::settings::paste_label()),
                format!(
                    "{} 会替你按下 {}，把录制粘贴到当前窗口的应用里，这需要辅助功能权限。你自己按 {} 则不需要。",
                    crate::settings::paste_label(),
                    crate::capture::system_paste_label(),
                    crate::capture::system_paste_label()
                ),
            )
        } else if state.fix {
            (
                "Pointo 还不能录制".to_owned(),
                format!("请先打开这些权限，再按一次快捷键。{note}")
                    .trim_end()
                    .to_owned(),
            )
        } else {
            let count = rows.iter().filter(|r| r.required).count();
            (
                format!(
                    "Pointo 需要{}项权限",
                    number_word(count)
                ),
                format!("每个按钮都会打开{settings}。{note}")
                    .trim_end()
                    .to_owned(),
            )
        };
        let mut card = div()
            .mt(px(22.0))
            .rounded(px(12.0))
            .bg(rgb(SURFACE))
            .border_1()
            .border_color(rgba(LINE))
            .flex()
            .flex_col();
        for (i, row) in rows.iter().enumerate() {
            if i > 0 {
                card = card.child(div().ml(px(14.0)).h(px(1.0)).bg(rgba(LINE)));
            }
            card = card.child(self.permission_row(row, phase, cx));
        }
        div()
            .flex()
            .flex_col()
            .items_center()
            .pt(px(44.0))
            .child(
                div()
                    .text_size(px(22.0))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(rgb(TEXT))
                    .child(title),
            )
            .child(
                div()
                    .pt(px(8.0))
                    .max_w(px(480.0))
                    .text_center()
                    .text_size(px(13.0))
                    .line_height(px(13.0 * 1.25 + 3.0))
                    .text_color(rgba(0xd0d0d0d9))
                    .child(body),
            )
            .child(card.w_full())
    }

    fn footer(&self, state: &ViewState, cx: &mut Context<Self>) -> Div {
        let primary: Option<(&str, &'static str, bool)> = match state.step {
            Step::Welcome => Some(("开始使用", "continue", true)),
            Step::HowItWorks => Some(("继续", "continue", true)),
            Step::Permissions => Some((
                if state.fix { "完成" } else { "继续" },
                "continue",
                state.ready,
            )),
            Step::Done => Some(("完成", "continue", true)),
            Step::TryIt => None,
        };
        let secondary: Option<(&str, &'static str)> = match state.step {
            Step::Permissions => {
                Some((if state.fix { "暂不" } else { "稍后设置" }, "later"))
            }
            Step::TryIt => Some(("关闭", "continue")),
            Step::Done => Some(("打开设置", "settings")),
            _ => None,
        };
        let show_dots = state.step != Step::Done && !state.fix;
        let show_back = state.index > 0 && !state.fix && state.step != Step::Done;
        let mut column = div().flex().flex_col().items_center().gap(px(10.0));
        if let Some((title, action, enabled)) = primary {
            column = column.child(
                primary_button("onboarding-primary", title, enabled).when(enabled, |d| {
                    d.on_click(cx.listener(move |view, _, _, _| view.act(action)))
                }),
            );
        }
        column = match secondary {
            Some((title, action)) => column.child(
                quiet_button("onboarding-secondary", title)
                    .on_click(cx.listener(move |view, _, _, _| view.act(action))),
            ),
            None => column.child(div().h(px(22.0))),
        };
        column.child(
            div()
                .relative()
                .w_full()
                .h(px(22.0))
                .mt(px(8.0))
                .flex()
                .items_center()
                .justify_center()
                .when(show_dots, |d| {
                    d.child(div().flex().items_center().gap(px(6.0)).children(
                        (0..state.count).map(|i| {
                            let current = i == state.index;
                            div()
                                .h(px(6.0))
                                .w(px(if current { 16.0 } else { 6.0 }))
                                .rounded_full()
                                .bg(if current { rgb(INK) } else { rgba(0xffffff2e) })
                        }),
                    ))
                })
                .when(show_back, |d| {
                    d.child(
                        div().absolute().left_0().child(
                            quiet_button("onboarding-back", "返回")
                                .on_click(cx.listener(|view, _, _, _| view.act("back"))),
                        ),
                    )
                }),
        )
    }

    fn caption(&self, cx: &mut Context<Self>) -> Option<Div> {
        if CAPTION_H == 0.0 {
            return None;
        }
        #[cfg(target_os = "windows")]
        let glyph_font = if crate::win::shell::windows_11() {
            "Segoe Fluent Icons"
        } else {
            "Segoe MDL2 Assets"
        };
        #[cfg(not(target_os = "windows"))]
        let glyph_font = ".SystemUIFont";
        let _ = cx;
        Some(
            div()
                .flex_none()
                .h(px(CAPTION_H))
                .w_full()
                .flex()
                .child(
                    div()
                        .id("onboarding-drag")
                        .flex_1()
                        .h_full()
                        .occlude()
                        .window_control_area(WindowControlArea::Drag),
                )
                .child(
                    div()
                        .id("onboarding-close")
                        .occlude()
                        .window_control_area(WindowControlArea::Close)
                        .w(px(46.0))
                        .h_full()
                        .flex()
                        .items_center()
                        .justify_center()
                        .font_family(glyph_font)
                        .text_size(px(10.0))
                        .text_color(rgb(TEXT))
                        .hover(|s| s.bg(rgb(0xc42b1c)).text_color(rgb(0xffffff)))
                        .child("\u{E8BB}"),
                ),
        )
    }
}

impl Render for OnboardingWindow {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let phase = self.opened.elapsed().as_secs_f32();
        let root = div()
            .relative()
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(CANVAS))
            .child(
                // The brand-blue glow from the top edge, behind the caption too.
                div()
                    .absolute()
                    .top_0()
                    .left_0()
                    .w_full()
                    .h(px(360.0))
                    .bg(linear_gradient(
                        180.0,
                        linear_color_stop(ink_glow(0.10), 0.0),
                        linear_color_stop(ink_glow(0.0), 1.0),
                    )),
            )
            .text_color(rgb(TEXT))
            .font_family(".SystemUIFont")
            .children(self.caption(cx));
        let Some(state) = self.state.clone() else {
            return root;
        };
        let tray = if cfg!(target_os = "windows") {
            "系统托盘"
        } else {
            "菜单栏"
        };
        let page: AnyElement = match state.step {
            Step::Welcome => self
                .centered(
                    self.welcome_art(phase),
                    200.0,
                    "欢迎使用 Pointo",
                    "录下屏幕和你的声音，在重点处画上标记，再整个粘贴给 AI 代理。".into(),
                )
                .into_any_element(),
            Step::HowItWorks => self.how_it_works().into_any_element(),
            Step::Permissions => self.permissions(&state, phase, cx).into_any_element(),
            Step::TryIt => self
                .centered(
                    self.try_art(phase),
                    164.0,
                    "录第一段",
                    "按一下上面的快捷键开始，边说边指向某处，再按一下结束。".to_owned(),
                )
                .into_any_element(),
            Step::Done => self
                .centered(
                    self.done_art(),
                    164.0,
                    "已复制到剪贴板",
                    format!(
                        "到 AI 代理里粘贴就行。Pointo 会留在{tray}里；想给它看什么，随时按快捷键。"
                    ),
                )
                .into_any_element(),
        };
        let t = ease_out_cubic(self.step_since.elapsed().as_secs_f32() / 0.3);
        let shift = (1.0 - t) * if self.forward { 24.0 } else { -24.0 };
        root.child(
            div()
                .relative()
                .flex_1()
                .min_h_0()
                .flex()
                .flex_col()
                .px(px(40.0))
                .pb(px(20.0))
                .child(
                    div()
                        .relative()
                        .w_full()
                        .left(px(shift))
                        .opacity(t)
                        .child(page),
                )
                .child(div().flex_1())
                .child(self.footer(&state, cx)),
        )
        .w(relative(1.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::onboarding::{Flow, Grants, Input};

    #[test]
    fn accepts_states_from_the_onboarding_flow() {
        let now = Instant::now();
        let mut window = OnboardingWindow {
            state: None,
            shortcut: "Alt+Shift+S".into(),
            events: Arc::new(|_| {}),
            step_since: now,
            forward: true,
            opened: now,
        };
        let mut flow = Flow::tour(Step::Welcome, Some(Grants::default()));
        let granted = Grants {
            statuses: Permission::REQUIRED
                .into_iter()
                .map(|permission| (permission, Status::Granted))
                .collect(),
            screen_needs_relaunch: false,
        };
        for (step, ready, input) in [
            (Step::Welcome, false, Input::Continue),
            (Step::HowItWorks, false, Input::Continue),
            (
                Step::Permissions,
                false,
                Input::Grants {
                    grants: granted,
                    now_ms: 0,
                },
            ),
            (Step::Permissions, true, Input::Continue),
            (Step::TryIt, true, Input::CaptureEnded { completed: true }),
            (Step::Done, true, Input::Continue),
        ] {
            let view = flow.view();
            let mut message = serde_json::to_value(&view).unwrap();
            message["type"] = "state".into();
            assert!(window.handle(message, None));
            let state = window
                .state
                .as_ref()
                .expect("the flow's state was accepted");
            assert_eq!(state.step, step);
            assert_eq!(state.ready, ready);
            assert_eq!(state.index, view.index);
            assert_eq!(state.count, view.count);
            assert_eq!(state.fix, view.fix);
            assert_eq!(state.rows.len(), view.rows.len());
            for (received, sent) in state.rows.iter().zip(&view.rows) {
                assert_eq!(received.permission, sent.permission);
                assert_eq!(received.status, sent.status);
                assert_eq!(received.requested, sent.requested);
                assert_eq!(received.required, sent.required);
                assert_eq!(received.relaunch, sent.relaunch);
            }
            flow.on(input);
        }
    }
}

/// INK (#3b5cf6) as Hsla with `alpha`, for glows and shadows.
fn ink_glow(alpha: f32) -> gpui::Hsla {
    let mut c: gpui::Hsla = rgb(INK).into();
    c.a = alpha;
    c
}
