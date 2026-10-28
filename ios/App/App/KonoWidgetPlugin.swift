import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// KONO's bridge to the home-screen widgets and the focus Live Activity (src/native.ts calls it as
/// `KonoWidget`). Registered in KonoViewController.
@objc(KonoWidgetPlugin)
public class KonoWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KonoWidgetPlugin"
    public let jsName = "KonoWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startFocus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endFocus", returnType: CAPPluginReturnPromise),
    ]

    /// The widgets' data (src/store/nativeBridge.ts WidgetSnapshot, as JSON), then a redraw.
    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.utf8.count < 20_000 else {
            call.reject("No widget data")
            return
        }
        UserDefaults(suiteName: KonoShared.appGroup)?.set(json, forKey: KonoShared.snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func startFocus(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
            let title = String((call.getString("title") ?? "Focus session").prefix(60))
            let endsAt = Date(timeIntervalSince1970: (call.getDouble("endsAt") ?? 0) / 1000)
            guard endsAt > Date() else { call.resolve(); return }
            Task {
                await Self.endAll()
                let content = ActivityContent(state: FocusAttributes.ContentState(endsAt: endsAt), staleDate: endsAt)
                _ = try? Activity.request(attributes: FocusAttributes(title: title), content: content, pushType: nil)
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func endFocus(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            Task { await Self.endAll(); call.resolve() }
            return
        }
        #endif
        call.resolve()
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private static func endAll() async {
        for activity in Activity<FocusAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
    #endif
}
