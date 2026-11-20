import AVFoundation
import AppKit
import Carbon.HIToolbox
import Combine
import SwiftUI

// `pointo-helper settings [--pane P] [--icon PNG] [--render DIR]`: the Settings window.
// Pointo decides everything (`src/settings.rs`) and sends what to show as JSON lines on stdin:
//   {"type":"state","version":"0.3.2","login":{"on":false,"available":true,"needsApproval":false},
//    "autoSend":true,"project":{"path":"~/code/app"},"shortcuts":[{"kind":"record","title":"Record","label":"⌥⇧S","key":"S",
//    "shift":true,"control":false,"option":true,"command":false,"isDefault":true,
//    "recording":false,"error":null},…],"microphone":{"selected":"default","value":"System default",
//    "options":[{"id":"default","title":"System default (…)","enabled":true},{"id":"-",…},…],
//    "note":null,"meter":"BuiltInMicrophoneDevice"},"transcriber":{…},"videoExport":false,
//    "retention":{"preset":"week","options":[{"id":"week","label":"…"}],"note":"…"},
//    "capturesSize":"1.2 GB","capturesDir":{"path":"~/Captures","custom":true},"permissions":[{"permission":"microphone","status":"granted",…}],
//    "updates":true}
//   {"type":"show","pane":"permissions"}  {"type":"request"|"open-settings","permission":"…"}
//   {"type":"close"}
// Clicks and key presses go back on stdout, e.g. {"action":"set","key":"autoSend","value":false},
// {"action":"record-shortcut","kind":"record"}, {"action":"shortcut","kind":"record",
// "keyCode":15,"modifiers":6144,"key":"r","reserved":false}, {"action":"cancel-shortcut"},
// {"action":"reset-shortcut","kind":"paste"}, {"action":"clear-shortcut","kind":"paste"},
// {"action":"grant","permission":"camera"},
// {"action":"reopen"}, {"action":"show-captures"}, {"action":"check-for-updates"},
// {"action":"set","key":"capturesDir","value":"/Users/me/Captures"} ("" resets), {"action":"set","key":"project","value":"/Users/me/app"} ("" is Automatic),
// {"action":"tour"}, {"action":"close"}.

// MARK: State

struct SettingsLogin: Decodable, Equatable {
  var on = false
  var available = true
  var needsApproval = false
}

struct SettingsShortcut: Decodable, Equatable, Identifiable {
  var kind = "record"
  var title = "开始录制"
  var label = "⌥⇧S"
  var key = "S"
  var shift = true
  var control = false
  var option = true
  var command = false
  var isDefault = true
  /// It can be turned off (paste); `label` is empty while it is.
  var clearable = false
  var recording = false
  var error: String?

  var id: String { kind }
  var off: Bool { label.isEmpty }
}

struct SettingsMenuOption: Decodable, Equatable {
  var id: String
  var title: String
  var enabled = true
}

struct SettingsMicrophone: Decodable, Equatable {
  /// "default" or a device's CoreAudio UID.
  var selected = "default"
  var value = "系统默认"
  /// An `id` of "-" is a separator.
  var options: [SettingsMenuOption] = [SettingsMenuOption(id: "default", title: "系统默认")]
  var note: String?
  /// The device to show the level of; nil until Microphone is allowed.
  var meter: String?
}

struct SettingsTranscriber: Decodable, Equatable {
  /// "qwen", or "command" while transcribeCommand is the engine and usable.
  var engine = "qwen"
  /// The spoken language Qwen3-ASR is asked for: "auto" or a language id such as "zh-CN".
  var language = "auto"
  var speech: SpeechStatus?
  /// The program's file name while transcribeCommand is the engine and usable.
  var command: String? = nil

  /// What the Language menu offers; a saved id that isn't one of these (say "zh-TW") shows as
  /// the choice with the same first part.
  static let languages: [(id: String, title: String)] = [("auto", "自动识别"), ("zh-CN", "普通话"), ("yue", "粤语"), ("en-US", "English")]

  var chosenLanguage: (id: String, title: String) {
    let primary = { (id: String) in id.split(separator: "-").first.map(String.init) ?? id }
    return Self.languages.first { $0.id == language }
      ?? Self.languages.first { $0.id != "auto" && primary($0.id) == primary(language) }
      ?? Self.languages[0]
  }
}

struct SettingsOption: Decodable, Equatable {
  var id: String
  var label: String
}

struct SettingsRetention: Decodable, Equatable {
  var preset: String? = "week"
  var options: [SettingsOption] = [
    SettingsOption(id: "week", label: "视频保留 7 天"),
    SettingsOption(id: "month", label: "视频保留 30 天"),
    SettingsOption(id: "forever", label: "永久保留"),
  ]
  var note = "视频和音频 7 天后移到废纸篓，每次录制的其余内容 30 天后移走。"
}

struct SettingsPermission: Decodable, Equatable, Identifiable {
  var permission: String
  var status = "not-determined"
  var required = true
  var requested = false
  var relaunch = false

  var id: String { permission }
  var granted: Bool { status == "granted" }
}

/// Where new captures go: `~`-relative, and whether it was chosen here (Reset shows).
struct SettingsCapturesDir: Decodable, Equatable {
  var path = "~/Library/Application Support/pointo/captures"
  var custom = false
}

/// The folder every capture goes to; no path is Automatic (the page, port or terminal decides).
struct SettingsProject: Decodable, Equatable {
  var path: String?
}

struct SettingsState: Decodable, Equatable {
  var version = "0.3.2"
  var login = SettingsLogin()
  var autoSend = true
  var project = SettingsProject()
  var shortcuts: [SettingsShortcut] = [
    SettingsShortcut(),
    SettingsShortcut(kind: "paste", title: "粘贴上一次录制", label: "⌥⇧V", key: "V", clearable: true),
  ]
  var microphone = SettingsMicrophone()
  var transcriber = SettingsTranscriber()
  var videoExport = false
  var lowerPlayback = false
  var playbackLevel = 20
  var retention = SettingsRetention()
  var capturesSize: String?
  var capturesDir = SettingsCapturesDir()
  var permissions: [SettingsPermission] = ["screen-recording", "microphone", "accessibility", "camera"]
    .map { SettingsPermission(permission: $0, required: ["screen-recording", "microphone", "accessibility"].contains($0)) }
  var updates = true

  var pasteLabel: String { shortcuts.first { $0.kind == "paste" }?.label ?? "⌥⇧V" }
  var recording: String? { shortcuts.first(where: \.recording)?.kind }
}

enum SettingsPane: String, CaseIterable {
  case general, recording, storage, permissions, about

  var title: String {
    switch self {
    case .general: "通用"
    case .recording: "录制"
    case .storage: "存储"
    case .permissions: "权限"
    case .about: "关于"
    }
  }

  var symbol: String {
    switch self {
    case .general: "gearshape.fill"
    case .recording: "record.circle"
    case .storage: "internaldrive.fill"
    case .permissions: "hand.raised.fill"
    case .about: "info"
    }
  }

  /// The icon tile's gradient, top to bottom.
  var tint: (Color, Color) {
    switch self {
    case .general, .about: (Color(white: 0.62), Color(white: 0.45))
    case .recording: (Color(red: 1, green: 0.42, blue: 0.38), Color(red: 0.92, green: 0.2, blue: 0.17))
    case .storage: (Color(red: 0.36, green: 0.66, blue: 1), Color(red: 0.16, green: 0.45, blue: 0.95))
    case .permissions: (Color(red: 0.36, green: 0.82, blue: 0.56), Color(red: 0.16, green: 0.66, blue: 0.4))
    }
  }
}

final class SettingsModel: ObservableObject {
  @Published private(set) var state = SettingsState()
  @Published var pane: SettingsPane
  let icon: NSImage?
  /// Rendering to PNGs: draw stand-in traffic lights where the window's would be.
  var rendering = false
  /// Rendering: the moment the shortcut keys are drawn at, instead of the clock.
  var renderTime: Double?
  let meter = MicMeter()
  /// Each shortcut's keys, by kind. Not published: the keys redraw from `clock`.
  private(set) var keys: [String: KeyController] = [:]
  let clock = KeyClock()
  var send: ([String: Any]) -> Void = { _ in }

  init(pane: SettingsPane, icon: NSImage?) {
    self.pane = pane
    self.icon = icon
  }

  static var now: Double { Date.timeIntervalSinceReferenceDate }

  func show(_ state: SettingsState, at t: Double = SettingsModel.now) {
    for shortcut in state.shortcuts {
      let labels = keyLabels(shortcut)
      if keys[shortcut.kind] == nil {
        keys[shortcut.kind] = KeyController(ShortcutField.metrics, shortcut: labels, reduce: SettingsMotion.reduce, at: t)
      }
      keys[shortcut.kind]?.update(shortcut: labels, recording: shortcut.recording, error: shortcut.error, at: t)
    }
    self.state = state
    clock.wake()
  }

  /// The modifiers down right now: each shortcut presses the ones it uses.
  func hold(_ flags: NSEvent.ModifierFlags, at t: Double = SettingsModel.now) {
    let mods = keyLabels(flags)
    for key in keys.values { key.hold(mods, at: t) }
    clock.wake()
  }

  /// A key went down while `kind` listens.
  func type(_ kind: String, _ label: String, at t: Double = SettingsModel.now) {
    keys[kind]?.type(label, at: t)
    clock.wake()
  }

  func advanceKeys(to t: Double) {
    for key in keys.values { key.motion.advance(to: t) }
  }

  func keysStill(at t: Double) -> Bool {
    keys.values.allSatisfy { $0.motion.still(t) }
  }

  /// Starts the keys from nothing (renders).
  func resetKeys() {
    keys = [:]
  }

  func act(_ action: String, _ fields: [String: Any] = [:]) {
    var message = fields
    message["action"] = action
    send(message)
  }

  func set(_ key: String, _ value: Any) {
    act("set", ["key": key, "value": value])
  }

  /// Choose… beside Project folder: a folder picker, sent as `project`.
  func chooseProjectFolder() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.canCreateDirectories = false
    panel.allowsMultipleSelection = false
    panel.prompt = "选择"
    panel.message = "所有录制都会发送到这个项目文件夹，不论录的是什么。"
    if let path = state.project.path {
      panel.directoryURL = URL(fileURLWithPath: NSString(string: path).expandingTildeInPath)
    }
    NSApp.activate(ignoringOtherApps: true)
    guard panel.runModal() == .OK, let url = panel.url else { return }
    set("project", url.path)
  }

  /// Change… under Storage: a folder picker, sent as `capturesDir`.
  func chooseCapturesFolder() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.canCreateDirectories = true
    panel.allowsMultipleSelection = false
    panel.prompt = "选择"
    panel.message = "新的录制会存到这个文件夹，已经录好的留在原处。"
    let current = NSString(string: state.capturesDir.path).expandingTildeInPath
    panel.directoryURL = URL(fileURLWithPath: current).deletingLastPathComponent()
    NSApp.activate(ignoringOtherApps: true)
    guard panel.runModal() == .OK, let url = panel.url else { return }
    set("capturesDir", url.path)
  }
}

// MARK: Look

struct SettingsTheme {
  let dark: Bool

  init(_ scheme: ColorScheme) { dark = scheme == .dark }

  private func ink(_ alpha: Double) -> Color { dark ? Color.white.opacity(alpha) : Color.black.opacity(alpha) }

  var window: Color { dark ? Color(white: 0.118) : Color(white: 0.955) }
  var sidebar: Color { dark ? Color(white: 0.15) : Color(white: 0.915) }
  var group: Color { dark ? Color.white.opacity(0.045) : Color.white }
  var groupLine: Color { ink(dark ? 0.075 : 0.08) }
  var separator: Color { ink(dark ? 0.07 : 0.075) }
  var text: Color { dark ? Color(white: 0.95) : Color(white: 0.1) }
  var secondary: Color { ink(dark ? 0.55 : 0.5) }
  var tertiary: Color { ink(dark ? 0.3 : 0.28) }
  var selection: Color { ink(dark ? 0.08 : 0.07) }
  var control: Color { ink(dark ? 0.08 : 0.06) }
  var controlLine: Color { ink(dark ? 0.1 : 0.1) }
  var track: Color { ink(dark ? 0.12 : 0.13) }
  var key: Color { dark ? Color.black.opacity(0.28) : Color.black.opacity(0.035) }
  var keyLine: Color { ink(dark ? 0.08 : 0.09) }
  var accent: Color { Color.accentColor }
  var positive: Color { Color(red: 0.2, green: 0.74, blue: 0.42) }
  var negative: Color { Color(red: 1, green: 0.27, blue: 0.23) }
}

private struct ThemeKey: EnvironmentKey {
  static let defaultValue = SettingsTheme(.dark)
}

extension EnvironmentValues {
  var settingsTheme: SettingsTheme {
    get { self[ThemeKey.self] }
    set { self[ThemeKey.self] = newValue }
  }
}

enum SettingsMotion {
  static let reduce = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
  /// Switch knobs and captions answering Pointo (bounce 0).
  static let state: Animation = reduce ? .easeOut(duration: 0.15) : .spring(duration: 0.25, bounce: 0)
  /// A caption replaced in place: a little blur with the fade, the old one leaving sooner.
  static let replace: AnyTransition = {
    let fade: AnyTransition = reduce ? .opacity : .modifier(active: SoftFade(on: true), identity: SoftFade(on: false))
    return .asymmetric(
      insertion: fade.animation(reduce ? .easeOut(duration: 0.15) : .spring(duration: 0.25, bounce: 0)),
      removal: fade.animation(reduce ? .easeOut(duration: 0.12) : .spring(duration: 0.18, bounce: 0))
    )
  }()
}

struct SoftFade: ViewModifier {
  let on: Bool

  func body(content: Content) -> some View {
    content.blur(radius: on ? 3 : 0).opacity(on ? 0 : 1)
  }
}

/// Runs the shortcut keys' TimelineView only while something moves.
final class KeyClock: ObservableObject {
  @Published private(set) var running = false
  /// Bumped on every start and stop, so a paused TimelineView never keeps a stale date.
  private(set) var revision = 0

  func wake() {
    guard !running else { return }
    revision += 1
    running = true
  }

  func sleep() {
    guard running else { return }
    revision += 1
    running = false
  }
}

/// Sizes: 16 titles, 14 rows, 13 keycaps, 12 captions.
enum SettingsMetrics {
  static let width: CGFloat = 620
  static let height: CGFloat = 448
  static let sidebar: CGFloat = 210
  static let titlebar: CGFloat = 52
  static let inset: CGFloat = 20
  static let row: CGFloat = 42
  static let radius: CGFloat = 12
}

// MARK: Controls

struct IconTile: View {
  let symbol: String
  let tint: (Color, Color)
  var size: CGFloat = 24

  var body: some View {
    RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
      .fill(LinearGradient(colors: [tint.0, tint.1], startPoint: .top, endPoint: .bottom))
      .overlay(
        RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
          .strokeBorder(Color.white.opacity(0.14), lineWidth: 0.5)
      )
      .overlay(
        Image(systemName: symbol)
          .font(.system(size: size * 0.5, weight: .semibold))
          .foregroundStyle(.white)
      )
      .frame(width: size, height: size)
  }
}

struct SettingsSwitch: View {
  @Environment(\.settingsTheme) private var theme
  let on: Bool
  var enabled = true
  let action: (Bool) -> Void

  var body: some View {
    Button { action(!on) } label: {
      Capsule()
        .fill(on ? theme.accent : theme.track)
        .overlay(alignment: on ? .trailing : .leading) {
          Circle()
            .fill(Color.white)
            .shadow(color: .black.opacity(0.22), radius: 1, y: 0.5)
            .padding(2)
        }
        .frame(width: 38, height: 22)
        .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .opacity(enabled ? 1 : 0.4)
    .disabled(!enabled)
    .animation(SettingsMotion.reduce ? nil : SettingsMotion.state, value: on)
  }
}

final class MenuPick: NSObject {
  let handler: (String) -> Void
  init(_ handler: @escaping (String) -> Void) { self.handler = handler }
  @objc func pick(_ item: NSMenuItem) {
    if let id = item.representedObject as? String { handler(id) }
  }
}

/// A value with up/down chevrons that opens a menu of choices where it was clicked, positioned
/// so the current choice sits under the pointer (like a pop-up button).
struct SettingsPopup: View {
  @Environment(\.settingsTheme) private var theme
  let value: String
  let options: [(id: String, title: String, enabled: Bool)]
  let selected: String?
  let pick: (String) -> Void

  var body: some View {
    Button(action: open) {
      HStack(spacing: 8) {
        Text(value)
          .font(.system(size: 14))
          .foregroundStyle(theme.text.opacity(0.85))
          .lineLimit(1)
          .truncationMode(.middle)
          .frame(maxWidth: 190, alignment: .trailing)
        Image(systemName: "chevron.up.chevron.down")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(theme.secondary)
          .frame(width: 20, height: 20)
          .overlay(Circle().strokeBorder(theme.controlLine, lineWidth: 1))
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }

  private func open() {
    let menu = NSMenu()
    menu.autoenablesItems = false
    let target = MenuPick(pick)
    var current: NSMenuItem?
    for option in options {
      if option.id == "-" {
        menu.addItem(.separator())
        continue
      }
      let item = NSMenuItem(title: option.title, action: #selector(MenuPick.pick(_:)), keyEquivalent: "")
      item.target = target
      item.representedObject = option.id
      item.isEnabled = option.enabled
      item.state = option.id == selected ? .on : .off
      menu.addItem(item)
      if option.id == selected { current = item }
    }
    guard let event = NSApp.currentEvent, let view = event.window?.contentView else { return }
    let point = view.convert(event.locationInWindow, from: nil)
    withExtendedLifetime(target) { _ = menu.popUp(positioning: current, at: point, in: view) }
  }
}

struct SettingsButton: View {
  @Environment(\.settingsTheme) private var theme
  let title: String
  var enabled = true
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(theme.text)
        .padding(.horizontal, 11)
        .frame(height: 24)
        .background(Capsule().fill(theme.control))
        .overlay(Capsule().strokeBorder(theme.controlLine, lineWidth: 1))
        .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .opacity(enabled ? 1 : 0.45)
    .disabled(!enabled)
  }
}

/// A rounded container of rows with hairline separators between them.
struct SettingsGroup<Content: View>: View {
  @Environment(\.settingsTheme) private var theme
  @ViewBuilder let content: () -> Content

  var body: some View {
    VStack(spacing: 0) { content() }
      .background(RoundedRectangle(cornerRadius: SettingsMetrics.radius, style: .continuous).fill(theme.group))
      .overlay(RoundedRectangle(cornerRadius: SettingsMetrics.radius, style: .continuous).strokeBorder(theme.groupLine, lineWidth: 1))
  }
}

struct SettingsSeparator: View {
  @Environment(\.settingsTheme) private var theme

  var body: some View {
    Rectangle().fill(theme.separator).frame(height: 1)
  }
}

struct SettingsRow<Trailing: View>: View {
  @Environment(\.settingsTheme) private var theme
  let title: String
  var enabled = true
  @ViewBuilder let trailing: () -> Trailing

  var body: some View {
    HStack(spacing: 12) {
      Text(title)
        .font(.system(size: 14))
        .foregroundStyle(enabled ? theme.text : theme.secondary)
      Spacer(minLength: 8)
      trailing()
    }
    .padding(.horizontal, 12)
    .frame(height: SettingsMetrics.row)
  }
}

/// A group's heading, eight points in from the group's edge, with an optional trailing control.
struct SettingsHeader<Trailing: View>: View {
  @Environment(\.settingsTheme) private var theme
  let title: String
  @ViewBuilder let trailing: () -> Trailing

  var body: some View {
    HStack {
      Text(title)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(theme.secondary)
      Spacer()
      trailing()
    }
    .padding(.horizontal, 8)
    .frame(height: 20)
    .padding(.top, 20)
    .padding(.bottom, 6)
  }
}

extension SettingsHeader where Trailing == EmptyView {
  init(_ title: String) {
    self.title = title
    trailing = { EmptyView() }
  }
}

struct SettingsCaption: View {
  @Environment(\.settingsTheme) private var theme
  let text: String
  var error = false

  var body: some View {
    Text(text)
      .font(.system(size: 12))
      .foregroundStyle(error ? theme.negative : theme.secondary)
      .lineSpacing(2)
      .fixedSize(horizontal: false, vertical: true)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
      .padding(.top, 7)
  }
}

// MARK: Input level

/// The level of the microphone recordings will use, only while the Recording pane is on screen
/// and only once Microphone is allowed (Pointo sends `meter` then). Its own object, so the level
/// redraws the meter and nothing else.
final class MicMeter: NSObject, ObservableObject, AVCaptureAudioDataOutputSampleBufferDelegate {
  /// 0…1, rising at once and falling at `release` a tick, like a level meter.
  @Published var level: Float = 0
  private var device: String?
  private var session: AVCaptureSession?
  private var output: AVCaptureAudioDataOutput?
  private var timer: Timer?
  private let queue = DispatchQueue(label: "dev.xiechimon.pointo.helper.meter")
  private static let floor: Float = -50
  private static let release: Float = 0.035

  /// Meters `id` (a CoreAudio UID), or stops with nil.
  func meter(_ id: String?) {
    guard id != device else { return }
    device = id
    timer?.invalidate()
    timer = nil
    output = nil
    if let old = session {
      queue.async { old.stopRunning() }
      session = nil
    }
    level = 0
    guard let id, AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else { return }
    let session = AVCaptureSession()
    let output = AVCaptureAudioDataOutput()
    output.setSampleBufferDelegate(self, queue: queue)
    self.session = session
    self.output = output
    queue.async {
      guard let device = AVCaptureDevice(uniqueID: id), let input = try? AVCaptureDeviceInput(device: device) else { return }
      session.beginConfiguration()
      if session.canAddInput(input) { session.addInput(input) }
      if session.canAddOutput(output) { session.addOutput(output) }
      session.commitConfiguration()
      session.startRunning()
    }
    timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in self?.tick() }
  }

  private func tick() {
    let channels = output?.connections.first?.audioChannels ?? []
    let db = channels.map(\.averagePowerLevel).max() ?? -160
    let target = max(0, min(1, (db - Self.floor) / -Self.floor))
    let next = target >= level ? target : max(target, level - Self.release)
    if next != level { level = next }
  }

  /// The connection's channels carry the levels; the samples themselves aren't needed.
  func captureOutput(_: AVCaptureOutput, didOutput _: CMSampleBuffer, from _: AVCaptureConnection) {}
}

/// Sixteen segments, lit left to right with the level.
struct LevelMeter: View {
  @Environment(\.settingsTheme) private var theme
  @ObservedObject var meter: MicMeter
  static let segments = 16

  var body: some View {
    let lit = Int((meter.level * Float(Self.segments)).rounded())
    HStack(spacing: 3) {
      ForEach(0..<Self.segments, id: \.self) { i in
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
          .fill(i < lit ? theme.text.opacity(0.7) : theme.track)
          .frame(width: 5, height: 12)
      }
    }
    .accessibilityElement()
    .accessibilityLabel("输入电平")
    .accessibilityValue("\(Int(meter.level * 100))%")
  }
}

// MARK: Shortcut recorder

/// A shortcut's row: its name, and its keys (`ShortcutField`). Clicking the row listens for a new
/// shortcut; clicking again, Esc, or clicking elsewhere cancels.
struct ShortcutRecorder: View {
  @Environment(\.settingsTheme) private var theme
  @ObservedObject var model: SettingsModel
  @ObservedObject var clock: KeyClock
  let shortcut: SettingsShortcut
  @State private var hovering = false

  var body: some View {
    VStack(spacing: 0) {
      SettingsGroup {
        HStack(spacing: 8) {
          Text(shortcut.title)
            .font(.system(size: 14))
            .foregroundStyle(theme.text)
          Spacer(minLength: 8)
          if !shortcut.isDefault && !shortcut.recording {
            Button { model.act("reset-shortcut", ["kind": shortcut.kind]) } label: {
              Image(systemName: "arrow.counterclockwise")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(theme.secondary)
                .frame(width: 20, height: 20)
                .background(Circle().fill(theme.control))
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .help("恢复为 \(shortcut.kind == "paste" ? "⌥⇧V" : "⌥⇧S")")
            .transition(SettingsMotion.replace)
          }
          if shortcut.clearable && !shortcut.off && !shortcut.recording {
            Button { model.act("clear-shortcut", ["kind": shortcut.kind]) } label: {
              Image(systemName: "xmark")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(theme.secondary)
                .frame(width: 20, height: 20)
                .background(Circle().fill(theme.control))
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .help("关闭")
            .accessibilityLabel("关闭「\(shortcut.title)」快捷键")
            .transition(SettingsMotion.replace)
          }
          field
        }
        .padding(.leading, 12)
        .padding(.trailing, 8)
        .frame(height: 50)
        .contentShape(Rectangle())
        .onTapGesture {
          model.act(shortcut.recording ? "cancel-shortcut" : "record-shortcut", ["kind": shortcut.kind])
        }
        .onHover { hovering = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("「\(shortcut.title)」快捷键")
        .accessibilityValue(shortcut.recording ? "等待按键" : shortcut.off ? "已关闭" : shortcut.label)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { model.act(shortcut.recording ? "cancel-shortcut" : "record-shortcut", ["kind": shortcut.kind]) }
      }
      ZStack(alignment: .leading) {
        SettingsCaption(text: caption, error: shortcut.error != nil && !shortcut.recording)
          .id(caption)
          .transition(SettingsMotion.replace)
      }
      .frame(height: 26, alignment: .top)
    }
    .animation(SettingsMotion.state, value: shortcut)
  }

  @ViewBuilder private var field: some View {
    if let controller = model.keys[shortcut.kind] {
      let motion = controller.motion
      if let t = model.renderTime {
        ShortcutField(k: motion, t: t, theme: theme)
      } else {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !clock.running)) { context in
          let t = clock.running ? context.date.timeIntervalSinceReferenceDate : SettingsModel.now
          let _ = model.advanceKeys(to: t)
          let _ = settle(at: t)
          ShortcutField(k: motion, t: t, theme: theme, hovering: hovering)
        }
        .id(clock.revision)
      }
    }
  }

  /// Stops the clock once every shortcut's keys have come to rest.
  private func settle(at t: Double) {
    guard clock.running, model.keysStill(at: t) else { return }
    DispatchQueue.main.async { [model, clock] in
      if model.keysStill(at: SettingsModel.now) { clock.sleep() }
    }
  }

  private var caption: String {
    if shortcut.recording { return shortcut.clearable ? "按 Esc 取消，按 Delete 关闭。" : "按 Esc 取消。" }
    if let error = shortcut.error { return error }
    return shortcut.kind == "paste"
      ? "把上一次录制粘贴到最前面的 App。"
      : "开始录制屏幕，再按一次结束。"
  }
}

// MARK: Panes

struct SettingsView: View {
  @ObservedObject var model: SettingsModel
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let theme = SettingsTheme(scheme)
    HStack(spacing: 0) {
      sidebar
        .frame(width: SettingsMetrics.sidebar)
        .background(theme.sidebar)
      Rectangle().fill(theme.separator).frame(width: 1)
      // Like System Settings, a pane replaces the last on the next frame: no fade between them.
      content(model.pane)
        .id(model.pane)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.window)
        .contentShape(Rectangle())
        .onTapGesture {
          if model.state.recording != nil { model.act("cancel-shortcut") }
        }
    }
    .frame(width: SettingsMetrics.width, height: SettingsMetrics.height)
    .environment(\.settingsTheme, theme)
  }

  // Sidebar

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 0) {
      if model.rendering { trafficLights } else { Spacer().frame(height: SettingsMetrics.titlebar) }
      item(.general)
      section("设置")
      VStack(spacing: 2) {
        item(.recording)
        item(.storage)
        item(.permissions)
      }
      section("Pointo")
      item(.about)
      Spacer()
    }
    .padding(.horizontal, 10)
  }

  private var trafficLights: some View {
    HStack(spacing: 8) {
      Circle().fill(Color(red: 1, green: 0.37, blue: 0.34))
      Circle().fill(Color(red: 1, green: 0.74, blue: 0.18))
      Circle().fill(Color(red: 0.16, green: 0.79, blue: 0.25))
    }
    .frame(width: 52, height: 12)
    .padding(.leading, 10)
    .frame(height: SettingsMetrics.titlebar, alignment: .center)
  }

  private func section(_ title: String) -> some View {
    Text(title)
      .font(.system(size: 12, weight: .semibold))
      .foregroundStyle(SettingsTheme(scheme).secondary)
      .padding(.leading, 10)
      .padding(.top, 16)
      .padding(.bottom, 4)
  }

  private func item(_ pane: SettingsPane) -> some View {
    let theme = SettingsTheme(scheme)
    let selected = model.pane == pane
    return HStack(spacing: 10) {
      IconTile(symbol: pane.symbol, tint: pane.tint)
      Text(pane.title)
        .font(.system(size: 14))
        .foregroundStyle(theme.text)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 8)
    .frame(height: 36)
    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(selected ? theme.selection : .clear))
    .contentShape(Rectangle())
    // Selects on mouse-down, as a sidebar does, rather than a button's mouse-up.
    .onLongPressGesture(minimumDuration: 0, perform: {}, onPressingChanged: { down in
      if down { select(pane) }
    })
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    .accessibilityAction { select(pane) }
  }

  private func select(_ pane: SettingsPane) {
    if model.state.recording != nil { model.act("cancel-shortcut") }
    model.pane = pane
  }

  // Content

  private func content(_ pane: SettingsPane) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 10) {
        IconTile(symbol: pane.symbol, tint: pane.tint)
        Text(pane.title)
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(SettingsTheme(scheme).text)
      }
      .frame(height: SettingsMetrics.titlebar)
      switch pane {
      case .general: general
      case .recording: recording
      case .storage: storage
      case .permissions: permissions
      case .about: about
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, SettingsMetrics.inset)
  }

  private var state: SettingsState { model.state }

  private var general: some View {
    VStack(spacing: 0) {
      SettingsGroup {
        SettingsRow(title: "登录时启动", enabled: state.login.available) {
          SettingsSwitch(on: state.login.on, enabled: state.login.available) { model.set("launchAtLogin", $0) }
        }
        SettingsSeparator()
        SettingsRow(title: "录制时调低其他声音") {
          SettingsSwitch(on: state.lowerPlayback) { model.set("lowerPlayback", $0) }
        }
        if state.lowerPlayback {
          SettingsSeparator()
          PlaybackLevelRow(model: model, level: state.playbackLevel)
        }
      }
      if state.login.needsApproval {
        SettingsCaption(text: "请在「系统设置 › 通用 › 登录项」里允许 Pointo。")
      } else if !state.login.available {
        SettingsCaption(text: "登录时启动只在已安装的 Pointo.app 里可用。")
      }
      ForEach(state.shortcuts) { shortcut in
        Color.clear.frame(height: 14)
        ShortcutRecorder(model: model, clock: model.clock, shortcut: shortcut)
      }
    }
  }

  private var recording: some View {
    let t = state.transcriber
    let language = t.chosenLanguage
    let theme = SettingsTheme(scheme)
    let mic = state.microphone
    return VStack(spacing: 0) {
      SettingsGroup {
        SettingsRow(title: "麦克风") {
          SettingsPopup(value: mic.value, options: mic.options.map { ($0.id, $0.title, $0.enabled) }, selected: mic.selected) {
            model.set("microphone", $0)
          }
        }
        if mic.meter != nil {
          SettingsSeparator()
          SettingsRow(title: "输入电平") { LevelMeter(meter: model.meter) }
        }
      }
      if let note = mic.note {
        SettingsCaption(text: note)
          .transition(.opacity)
      }
      Color.clear.frame(height: 20)
      SettingsGroup {
        SettingsRow(title: "语音转写") {
          Text(t.command.map { "命令（\($0)）" } ?? "Qwen3-ASR（本机）")
            .font(.system(size: 14))
            .foregroundStyle(theme.secondary)
        }
        if t.engine == "qwen" {
          SettingsSeparator()
          SettingsRow(title: "语言") {
            SettingsPopup(value: language.title, options: SettingsTranscriber.languages.map { ($0.id, $0.title, true) }, selected: language.id) {
              model.set("language", $0)
            }
          }
        }
      }
      SettingsCaption(text: t.engine == "command"
        ? "「命令」会运行 config.json 里的 transcribeCommand。失败时，这次录制改用 Qwen3-ASR。"
        : "Qwen3-ASR 在这台电脑上运行，听得懂普通话、粤语和中英混说，录音不会上传。首次使用会下载约 850 MB 的模型。")
      if t.speech?.notReady == true, let line = t.speech?.line {
        SettingsCaption(text: line)
      }
      SettingsHeader("实验功能")
      SettingsGroup {
        SettingsRow(title: "视频导出") {
          SettingsSwitch(on: state.videoExport) { model.set("videoExport", $0) }
        }
      }
      SettingsCaption(text: "在菜单里加入「导出为视频…」。")
    }
    .animation(SettingsMotion.state, value: mic)
  }

  private var storage: some View {
    let r = state.retention
    let current = r.options.first { $0.id == r.preset }?.label ?? "自定义"
    return VStack(spacing: 0) {
      SettingsGroup {
        SettingsRow(title: "录制保留时长") {
          SettingsPopup(value: current, options: r.options.map { ($0.id, $0.label, true) }, selected: r.preset) {
            model.set("retention", $0)
          }
        }
      }
      if !r.note.isEmpty {
        SettingsCaption(text: r.note)
      }
      SettingsHeader("录制")
      SettingsGroup {
        HStack(spacing: 12) {
          VStack(alignment: .leading, spacing: 1) {
            Text("位置").font(.system(size: 14)).foregroundStyle(SettingsTheme(scheme).text)
            Text(state.capturesDir.path)
              .font(.system(size: 12, design: .monospaced))
              .foregroundStyle(SettingsTheme(scheme).secondary)
              .truncationMode(.head)
          }
          .lineLimit(1)
          Spacer(minLength: 8)
          if state.capturesDir.custom {
            SettingsButton(title: "重置") { model.set("capturesDir", "") }
          }
          SettingsButton(title: "更改…") { model.chooseCapturesFolder() }
        }
        .padding(.horizontal, 12)
        .frame(height: 52)
        SettingsSeparator()
        SettingsRow(title: "大小") {
          Text(state.capturesSize ?? "正在计算…")
            .font(.system(size: 14).monospacedDigit())
            .foregroundStyle(SettingsTheme(scheme).secondary)
          SettingsButton(title: "在访达中显示") { model.act("show-captures") }
        }
      }
    }
  }

  private var permissions: some View {
    let required = state.permissions.filter(\.required)
    let optional = state.permissions.filter { !$0.required }
    return VStack(spacing: 0) {
      SettingsGroup { permissionRows(required) }
      SettingsCaption(text: "录制需要这三项权限。")
      SettingsHeader("用到时再开")
      SettingsGroup { permissionRows(optional) }
    }
  }

  @ViewBuilder private func permissionRows(_ rows: [SettingsPermission]) -> some View {
    ForEach(Array(rows.enumerated()), id: \.element.id) { i, row in
      if i > 0 { SettingsSeparator() }
      PermissionLine(row: row, paste: state.pasteLabel, model: model)
    }
  }

  private var about: some View {
    let theme = SettingsTheme(scheme)
    return VStack(spacing: 0) {
      SettingsGroup {
        HStack(spacing: 12) {
          if let icon = model.icon {
            Image(nsImage: icon).resizable().interpolation(.high).frame(width: 40, height: 40)
          }
          VStack(alignment: .leading, spacing: 1) {
            Text("Pointo").font(.system(size: 14, weight: .semibold)).foregroundStyle(theme.text)
            Text("版本 \(state.version)").font(.system(size: 12).monospacedDigit()).foregroundStyle(theme.secondary)
          }
          Spacer()
          SettingsButton(title: "检查更新…", enabled: state.updates) { model.act("check-for-updates") }
        }
        .padding(.horizontal, 12)
        .frame(height: 64)
      }
      if !state.updates {
        SettingsCaption(text: "更新只在已安装的 Pointo.app 里可用。")
      }
      SettingsHeader("链接")
      SettingsGroup {
        link("官网", "xiechimon.github.io/pointo", "https://xiechimon.github.io/pointo")
        SettingsSeparator()
        link("源码", "github.com/xiechimon/pointo", "https://github.com/xiechimon/pointo")
        SettingsSeparator()
        SettingsRow(title: "欢迎导览") {
          SettingsButton(title: "查看") { model.act("tour") }
        }
      }
    }
  }

  private func link(_ title: String, _ shown: String, _ url: String) -> some View {
    let theme = SettingsTheme(scheme)
    return Button {
      if let url = URL(string: url) { NSWorkspace.shared.open(url) }
    } label: {
      SettingsRow(title: title) {
        HStack(spacing: 5) {
          Text(shown).font(.system(size: 14)).foregroundStyle(theme.secondary)
          Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .semibold)).foregroundStyle(theme.tertiary)
        }
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

struct PermissionLine: View {
  @Environment(\.settingsTheme) private var theme
  let row: SettingsPermission
  let paste: String
  @ObservedObject var model: SettingsModel

  var body: some View {
    let info = permissionInfo(row.permission, paste: paste)
    HStack(spacing: 12) {
      IconTile(symbol: info.symbol, tint: tint, size: 26)
      VStack(alignment: .leading, spacing: 1) {
        Text(name).font(.system(size: 14)).foregroundStyle(theme.text)
        Text(why).font(.system(size: 12)).foregroundStyle(theme.secondary)
      }
      .lineLimit(1)
      Spacer(minLength: 8)
      ZStack(alignment: .trailing) {
        if row.granted && row.relaunch {
          SettingsButton(title: "重新打开 Pointo") { model.act("reopen") }
        } else if row.granted {
          HStack(spacing: 5) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(theme.positive)
            Text("已允许").foregroundStyle(theme.secondary)
          }
          .font(.system(size: 12, weight: .medium))
        } else {
          SettingsButton(title: row.requested || row.status == "denied" ? "打开系统设置" : "允许") {
            model.act("grant", ["permission": row.permission])
          }
        }
      }
      .animation(SettingsMotion.state, value: row)
    }
    .padding(.horizontal, 12)
    .frame(height: 52)
  }

  /// Shorter than onboarding's, to fit one line beside the button.
  private var name: String {
    switch row.permission {
    case "screen-recording": "屏幕与系统录音"
    case "accessibility": "辅助功能"
    default: permissionInfo(row.permission, paste: paste).name
    }
  }

  private var why: String {
    switch row.permission {
    case "screen-recording": "用来看到屏幕"
    case "microphone": "用来听到你说话"
    case "accessibility": "用于 ⌘Z 和 \(paste)"
    case "camera": "用来显示数据线连接的 iPhone"
    default: ""
    }
  }

  private var tint: (Color, Color) {
    switch row.permission {
    case "screen-recording": (Color(red: 0.62, green: 0.5, blue: 1), Color(red: 0.44, green: 0.32, blue: 0.92))
    case "microphone": (Color(red: 1, green: 0.62, blue: 0.3), Color(red: 0.95, green: 0.44, blue: 0.12))
    case "accessibility": (Color(red: 0.36, green: 0.66, blue: 1), Color(red: 0.16, green: 0.45, blue: 0.95))
    case "camera": (Color(red: 0.36, green: 0.82, blue: 0.56), Color(red: 0.16, green: 0.66, blue: 0.4))
    default: (Color(white: 0.62), Color(white: 0.45))
    }
  }
}

// MARK: Recording keys

enum ShortcutKeys {
  /// The name a key is shown with, as `settings::key_label` names it; nil for Esc or a key
  /// that types nothing.
  static func label(keyCode: Int, typed: String) -> String? {
    let named: [Int: String] = [
      kVK_F1: "F1", kVK_F2: "F2", kVK_F3: "F3", kVK_F4: "F4", kVK_F5: "F5", kVK_F6: "F6",
      kVK_F7: "F7", kVK_F8: "F8", kVK_F9: "F9", kVK_F10: "F10", kVK_F11: "F11", kVK_F12: "F12",
      kVK_F13: "F13", kVK_F14: "F14", kVK_F15: "F15", kVK_F16: "F16",
      kVK_Space: "Space", kVK_Return: "↩", kVK_Tab: "⇥", kVK_Delete: "⌫",
      kVK_LeftArrow: "←", kVK_RightArrow: "→", kVK_DownArrow: "↓", kVK_UpArrow: "↑",
    ]
    if let name = named[keyCode] { return name }
    if keyCode == kVK_Escape { return nil }
    let chars = typed.filter { !$0.isWhitespace && !($0.unicodeScalars.first.map(CharacterSet.controlCharacters.contains) ?? false) }
    guard chars.count == 1 else { return nil }
    return chars.uppercased()
  }

  static func carbon(_ flags: NSEvent.ModifierFlags) -> Int {
    var bits = 0
    if flags.contains(.command) { bits |= cmdKey }
    if flags.contains(.shift) { bits |= shiftKey }
    if flags.contains(.option) { bits |= optionKey }
    if flags.contains(.control) { bits |= controlKey }
    return bits
  }

  /// Whether macOS has this combination as one of its enabled shortcuts (Keyboard Shortcuts).
  static func reserved(keyCode: Int, modifiers: Int) -> Bool {
    var unmanaged: Unmanaged<CFArray>?
    guard CopySymbolicHotKeys(&unmanaged) == noErr,
          let hotkeys = unmanaged?.takeRetainedValue() as? [[String: Any]]
    else { return false }
    let mask = cmdKey | shiftKey | optionKey | controlKey
    return hotkeys.contains { hotkey in
      (hotkey[kHISymbolicHotKeyEnabled as String] as? Bool) == true
        && (hotkey[kHISymbolicHotKeyCode as String] as? Int) == keyCode
        && ((hotkey[kHISymbolicHotKeyModifiers as String] as? Int) ?? -1) & mask == modifiers
    }
  }
}

// MARK: Window

final class SettingsWindow: NSObject, NSApplicationDelegate, NSWindowDelegate {
  static func run(arguments: [String]) -> Never {
    let pane = option("--pane", in: arguments).flatMap(SettingsPane.init(rawValue:)) ?? .general
    let model = SettingsModel(pane: pane, icon: Onboarding.loadIcon(option("--icon", in: arguments)))
    if let dir = option("--render", in: arguments) {
      MainActor.assumeIsolated {
        if arguments.contains("--shortcut-clip") {
          renderShortcutClip(model: model, to: URL(filePath: dir))
        } else {
          render(model: model, to: URL(filePath: dir))
        }
      }
      exit(0)
    }
    let app = NSApplication.shared
    let delegate = SettingsWindow(model: model)
    app.setActivationPolicy(.accessory)
    app.delegate = delegate
    withExtendedLifetime(delegate) { app.run() }
    exit(0)
  }

  let model: SettingsModel
  var window: NSWindow?
  private lazy var keys = HelperWindowKeys(
    window: { [weak self] in self?.window },
    enabled: { [weak self] in self?.model.state.recording == nil }
  )
  private var monitor: Any?
  /// Modifiers held while Settings is in front, so each shortcut presses the keys it uses.
  private var modifierMonitor: Any?
  private var presented = false
  private var paneWatch: AnyCancellable?

  init(model: SettingsModel) {
    self.model = model
  }

  func applicationDidFinishLaunching(_: Notification) {
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: SettingsMetrics.width, height: SettingsMetrics.height),
      styleMask: [.titled, .closable, .miniaturizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    // A toolbar makes the title bar as tall as the pane titles, so the traffic lights share their line.
    let toolbar = NSToolbar(identifier: "pointo-settings")
    toolbar.showsBaselineSeparator = false
    window.toolbar = toolbar
    window.toolbarStyle = .unified
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.title = "Pointo 设置"
    window.isMovableByWindowBackground = true
    window.isReleasedWhenClosed = false
    window.delegate = self
    let host = FirstClickHostingView(rootView: SettingsView(model: model))
    // The panes draw under the title bar themselves (the sidebar holds the traffic lights).
    host.safeAreaRegions = []
    host.sizingOptions = []
    window.contentView = host
    // With a toolbar, the content size leaves out the title bar; the window is exactly the panes.
    window.setFrame(NSRect(x: 0, y: 0, width: SettingsMetrics.width, height: SettingsMetrics.height), display: false)
    host.frame = window.contentLayoutRect.union(NSRect(origin: .zero, size: window.frame.size))
    host.autoresizingMask = [.width, .height]
    window.center()
    self.window = window
    _ = keys
    model.send = { emit($0) }
    modifierMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
      self?.model.hold(event.modifierFlags)
      return event
    }
    paneWatch = model.$pane.sink { [weak self] pane in self?.updateMeter(pane: pane) }
    readCommands()
  }

  func windowDidChangeOcclusionState(_: Notification) {
    updateMeter()
  }

  /// The level shows only while someone can see it: the Recording pane, on screen.
  private func updateMeter(pane: SettingsPane? = nil) {
    let onScreen = window?.occlusionState.contains(.visible) == true && window?.isMiniaturized == false
    let showing = (pane ?? model.pane) == .recording && onScreen
    let device = showing ? model.state.microphone.meter : nil
    // After the pane has drawn: making the capture session shouldn't hold up its frame.
    DispatchQueue.main.async { [model] in model.meter.meter(device) }
  }

  func windowWillClose(_: Notification) {
    emit(["action": "close"])
    keys.handBack()
    exit(0)
  }

  func windowDidResignKey(_: Notification) {
    if model.state.recording != nil { model.act("cancel-shortcut") }
    model.hold([])
  }

  private func present(_ pane: SettingsPane?) {
    if let pane { model.pane = pane }
    keys.bringForward(window)
  }

  /// Listens for keys only while a recorder is waiting for one.
  private func listen(_ on: Bool) {
    if on, monitor == nil {
      monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
        guard let self, let kind = self.model.state.recording else { return event }
        if event.keyCode == UInt16(kVK_Escape) {
          self.model.act("cancel-shortcut")
          return nil
        }
        let flags = event.modifierFlags.intersection([.command, .shift, .option, .control])
        let modifiers = ShortcutKeys.carbon(flags)
        let keyCode = Int(event.keyCode)
        let typed = event.characters(byApplyingModifiers: []) ?? ""
        if let label = ShortcutKeys.label(keyCode: keyCode, typed: typed) {
          self.model.type(kind, label)
        }
        self.model.act("shortcut", [
          "kind": kind,
          "keyCode": keyCode,
          "modifiers": modifiers,
          "key": typed,
          "reserved": ShortcutKeys.reserved(keyCode: keyCode, modifiers: modifiers),
        ])
        return nil
      }
    } else if !on, let monitor {
      NSEvent.removeMonitor(monitor)
      self.monitor = nil
    }
  }

  private func readCommands() {
    Thread.detachNewThread {
      while let line = readLine() {
        guard let data = line.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String
        else { continue }
        let permission = object["permission"] as? String ?? ""
        let pane = (object["pane"] as? String).flatMap(SettingsPane.init(rawValue:))
        let state = type == "state" ? try? JSONDecoder().decode(SettingsState.self, from: data) : nil
        DispatchQueue.main.async {
          switch type {
          case "state":
            guard let state else { return }
            self.model.show(state)
            self.listen(state.recording != nil)
            self.updateMeter()
            if !self.presented {
              self.presented = true
              self.present(nil)
            }
          case "show": self.present(pane)
          case "request": Permissions.request(permission)
          case "open-settings": Permissions.openSettings(permission)
          case "close":
            self.keys.handBack()
            exit(0)
          default: break
          }
        }
      }
      exit(0)
    }
  }

  /// The General pane at 60 fps through one take on the shortcuts, as numbered PNGs for a video:
  /// hold ⌥⇧, listen, a refused ⌘V, listen again with ⌥ let go and pressed again, ⌃⌥⌘R accepted
  /// and held, then Esc on Paste.
  @MainActor static func renderShortcutClip(model: SettingsModel, to dir: URL) {
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    model.rendering = true
    let light = CommandLine.arguments.contains("--light")
    let base = SettingsState()
    var listening = base
    listening.shortcuts[0].recording = true
    var refused = base
    refused.shortcuts[0].error = "App 会用到 ⌘V，请加上 ⌥ 或 ⌃。"
    var custom = base
    custom.shortcuts[0] = SettingsShortcut(kind: "record", title: "开始录制", label: "⌃⌥⌘R", key: "R", shift: false, control: true, option: true, command: true, isDefault: false)
    var pasteListening = custom
    pasteListening.shortcuts[1].recording = true
    let script: [(Double, (SettingsModel, Double) -> Void)] = [
      (0, { m, t in m.show(base, at: t) }),
      (0.6, { m, t in m.hold(.option, at: t) }),
      (0.75, { m, t in m.hold([.option, .shift], at: t) }),
      (1.45, { m, t in m.hold([], at: t) }),
      (1.95, { m, t in m.show(listening, at: t) }),
      (2.55, { m, t in m.hold(.command, at: t) }),
      (2.95, { m, t in m.type("record", "V", at: t) }),
      (2.97, { m, t in m.show(refused, at: t) }),
      (3.25, { m, t in m.hold([], at: t) }),
      (4.3, { m, t in m.show(listening, at: t) }),
      (4.75, { m, t in m.hold(.control, at: t) }),
      (4.9, { m, t in m.hold([.control, .option], at: t) }),
      (5.05, { m, t in m.hold([.control, .option, .command], at: t) }),
      (5.35, { m, t in m.hold([.control, .command], at: t) }),
      (5.6, { m, t in m.hold([.control, .option, .command], at: t) }),
      (5.95, { m, t in m.type("record", "R", at: t) }),
      (5.97, { m, t in m.show(custom, at: t) }),
      (6.35, { m, t in m.hold([], at: t) }),
      (7.1, { m, t in m.hold([.control, .option, .command], at: t) }),
      (7.7, { m, t in m.hold([], at: t) }),
      (8.2, { m, t in m.show(pasteListening, at: t) }),
      (9.0, { m, t in m.show(custom, at: t) }),
    ]
    model.resetKeys()
    model.pane = .general
    var next = 0
    let fps = 60.0
    for frame in 0..<Int(9.6 * fps) {
      let t = Double(frame) / fps
      while next < script.count, script[next].0 <= t {
        model.advanceKeys(to: script[next].0)
        script[next].1(model, script[next].0)
        next += 1
      }
      model.advanceKeys(to: t)
      model.renderTime = t
      let view = SettingsView(model: model)
        .environment(\.colorScheme, light ? .light : .dark)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      let renderer = ImageRenderer(content: view)
      renderer.scale = 2
      guard let image = renderer.cgImage else { continue }
      let url = dir.appending(path: String(format: "%04d.png", frame))
      try? NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])?.write(to: url)
    }
  }

  /// Every pane, dark and light, plus each state of the shortcut keys, as PNGs.
  @MainActor static func render(model: SettingsModel, to dir: URL) {
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    model.rendering = true
    var base = SettingsState()
    base.capturesSize = "1.4 GB"
    base.permissions = base.permissions.map { row in
      var row = row
      row.status = ["screen-recording", "microphone", "accessibility"].contains(row.permission) ? "granted" : "not-determined"
      if row.permission == "camera" { row.status = "denied" }
      return row
    }
    let devices = [
      SettingsMenuOption(id: "BuiltInMicrophoneDevice", title: "MacBook Pro Microphone"),
      SettingsMenuOption(id: "AppleUSBAudioEngine:Shure:MV7", title: "Shure MV7"),
    ]
    let micOptions = [SettingsMenuOption(id: "default", title: "系统默认（MacBook Pro Microphone）"), SettingsMenuOption(id: "-", title: "", enabled: false)] + devices
    base.microphone = SettingsMicrophone(selected: "default", value: "系统默认", options: micOptions, note: nil, meter: "BuiltInMicrophoneDevice")
    var listening = base
    listening.shortcuts[0].recording = true
    var refused = base
    refused.shortcuts[0].error = "App 会用到 ⌘V，请加上 ⌥ 或 ⌃。"
    var custom = base
    custom.shortcuts[0] = SettingsShortcut(kind: "record", title: "开始录制", label: "⌃⌥⌘R", key: "R", shift: false, control: true, option: true, command: true, isDefault: false)
    custom.login.on = true
    var pasteOff = base
    pasteOff.shortcuts[1] = SettingsShortcut(kind: "paste", title: "粘贴上一次录制", label: "", key: "", shift: false, option: false, isDefault: false, clearable: true)
    var pasteListening = base
    pasteListening.shortcuts[1].recording = true
    var lowered = base
    lowered.lowerPlayback = true
    // The shortcut keys are drawn at a moment after a few steps: (time, step).
    let rest: [(Double, (SettingsModel) -> Void)] = [(0, { $0.show(base, at: 0) })]
    let listen = rest + [(1, { $0.show(listening, at: 1) })]
    let refuse = listen + [
      (1.3, { $0.hold(.command, at: 1.3) }), (1.6, { $0.type("record", "V", at: 1.6) }),
      (1.62, { $0.show(refused, at: 1.62) }), (1.8, { $0.hold([], at: 1.8) }),
    ]
    let accept = listen + [
      (1.3, { $0.hold([.control, .option, .command], at: 1.3) }), (1.6, { $0.type("record", "R", at: 1.6) }),
      (1.62, { $0.show(custom, at: 1.62) }), (1.9, { $0.hold([], at: 1.9) }),
    ]
    let shortcutStages: [String: ([(Double, (SettingsModel) -> Void)], Double)] = [
      "general": (rest, 5),
      "general-held": (rest + [(1, { $0.hold([.option, .shift], at: 1) })], 2),
      "general-listening": (listen, 2.5),
      "general-partial": (listen + [(1.5, { $0.hold([.control, .option], at: 1.5) })], 2.5),
      "general-refused": (refuse, 2.02),
      "general-refused-reason": (refuse, 3.2),
      "general-accepted": (accept, 1.86),
      "general-custom": ([(0, { $0.show(custom, at: 0) })], 5),
      "general-paste-listening": (rest + [(1, { $0.show(pasteListening, at: 1) })], 2.5),
      "general-paste-cleared": (rest + [(1, { $0.show(pasteListening, at: 1) }), (1.5, { $0.type("paste", "⌫", at: 1.5) }), (1.52, { $0.show(pasteOff, at: 1.52) })], 1.7),
      "general-paste-off": ([(0, { $0.show(pasteOff, at: 0) })], 5),
    ]
    var downloading = base
    downloading.transcriber.speech = SpeechStatus(state: "downloading", progress: 0.42)
    var failed = base
    failed.transcriber.speech = SpeechStatus(state: "failed", error: "offline")
    var ready = base
    ready.transcriber.speech = SpeechStatus(state: "ready", progress: 1)
    var language = base
    language.transcriber.language = "yue"
    language.transcriber.speech = SpeechStatus(state: "ready", progress: 1)
    var command = base
    command.transcriber = SettingsTranscriber(engine: "command", command: "whisper-pointo")
    var missing = base
    missing.permissions[0].status = "granted"
    missing.permissions[0].relaunch = true
    missing.permissions[2].status = "not-determined"
    missing.permissions[2].requested = true
    var noUpdates = base
    noUpdates.updates = false
    var storageCustom = base
    storageCustom.capturesDir = SettingsCapturesDir(path: "~/Documents/Pointo Captures", custom: true)
    var micChosen = base
    micChosen.microphone = SettingsMicrophone(selected: devices[1].id, value: "Shure MV7", options: micOptions, note: nil, meter: devices[1].id)
    var micMissing = base
    micMissing.microphone = SettingsMicrophone(
      selected: "airpods", value: "AirPods Pro",
      options: micOptions + [SettingsMenuOption(id: "airpods", title: "AirPods Pro（未连接）", enabled: false)],
      note: "AirPods Pro 未连接，改用 MacBook Pro Microphone。", meter: devices[0].id
    )
    var micNotAllowed = base
    micNotAllowed.microphone.meter = nil
    let samples: [(String, SettingsPane, SettingsState)] = [
      ("general", .general, base),
      ("general-held", .general, base),
      ("general-listening", .general, listening),
      ("general-partial", .general, listening),
      ("general-refused", .general, refused),
      ("general-refused-reason", .general, refused),
      ("general-accepted", .general, custom),
      ("general-custom", .general, custom),
      ("general-paste-listening", .general, pasteListening),
      ("general-paste-cleared", .general, pasteOff),
      ("general-paste-off", .general, pasteOff),
      ("general-lower-playback", .general, lowered),
      ("recording", .recording, base),
      ("recording-mic-chosen", .recording, micChosen),
      ("recording-mic-missing", .recording, micMissing),
      ("recording-mic-not-allowed", .recording, micNotAllowed),
      ("recording-downloading", .recording, downloading),
      ("recording-failed", .recording, failed),
      ("recording-ready", .recording, ready),
      ("recording-language", .recording, language),
      ("recording-command", .recording, command),
      ("storage", .storage, base),
      ("storage-custom", .storage, storageCustom),
      ("permissions", .permissions, base),
      ("permissions-missing", .permissions, missing),
      ("about", .about, base),
      ("about-dev", .about, noUpdates),
    ]
    var index = 0
    for scheme in [ColorScheme.dark, .light] {
      for (name, pane, state) in samples {
        if scheme == .light && name.contains("-") && !name.hasPrefix("general-") && !name.hasPrefix("recording-mic") { continue }
        index += 1
        model.resetKeys()
        if let (steps, t) = shortcutStages[name] {
          for (at, step) in steps {
            model.advanceKeys(to: at)
            step(model)
          }
          model.advanceKeys(to: t)
          model.renderTime = t
        } else {
          model.show(state, at: 0)
          model.renderTime = 5
        }
        model.pane = pane
        model.meter.level = 0.44
        let view = SettingsView(model: model)
          .environment(\.colorScheme, scheme)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        guard let image = renderer.cgImage else { continue }
        let rep = NSBitmapImageRep(cgImage: image)
        let suffix = scheme == .dark ? "dark" : "light"
        let url = dir.appending(path: String(format: "%02d-%@-%@.png", index, name, suffix))
        try? rep.representation(using: .png, properties: [:])?.write(to: url)
      }
    }
  }
}

/// Sends the level when the slider is let go, not on every step of the drag.
private struct PlaybackLevelRow: View {
  @Environment(\.settingsTheme) private var theme
  @ObservedObject var model: SettingsModel
  let level: Int
  @State private var draft: Double

  init(model: SettingsModel, level: Int) {
    self.model = model
    self.level = level
    _draft = State(initialValue: Double(level))
  }

  var body: some View {
    SettingsRow(title: "调低到") {
      // ImageRenderer cannot draw the AppKit-backed slider; previews get a plain track.
      if model.rendering {
        Capsule().fill(theme.track)
          .overlay(alignment: .leading) { Capsule().fill(theme.accent).frame(width: 150 * draft / 100) }
          .frame(width: 150, height: 4)
      } else {
        Slider(value: $draft, in: 0...100) { editing in
          if !editing { model.set("playbackLevel", Int(draft.rounded())) }
        }
        .frame(width: 150)
      }
      Text("\(Int(draft.rounded()))%")
        .font(.system(size: 14).monospacedDigit())
        .foregroundStyle(theme.secondary)
        .frame(width: 40, alignment: .trailing)
    }
    .onChange(of: level) { _, value in draft = Double(value) }
  }
}
