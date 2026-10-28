import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// The focus session on the lock screen and Dynamic Island. Shared by the app (which starts and ends it,
/// KonoWidgetPlugin) and the KONOWidget extension (which draws it): add this file to both targets.
@available(iOS 16.1, *)
struct FocusAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endsAt: Date
    }
    var title: String
}
#endif

/// Where the app leaves the widgets' data: an App Group both targets belong to (Signing & Capabilities).
enum KonoShared {
    static let appGroup = "group.app.kono.study"
    static let snapshotKey = "snapshot"
}
