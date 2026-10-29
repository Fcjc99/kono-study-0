import WidgetKit
import SwiftUI
import ActivityKit

// KONO's home-screen widgets and the focus Live Activity. The app writes what they show
// (src/store/nativeBridge.ts WidgetSnapshot) into the shared App Group; these only read it.
// The extension's deployment target is iOS 17 (docs/app-store.md); the app itself runs on older iOS.

struct KonoSnapshot: Decodable {
    struct Next: Decodable { let title: String; let why: String }
    struct Today: Decodable { let done: Int; let left: Int }
    struct Kono: Decodable { let mood: String; let line: String; let full: Int; let happy: Int; let asleep: Bool }
    let updated: String
    let name: String
    let next: [Next]
    let today: Today
    let kono: Kono

    static func load() -> KonoSnapshot? {
        guard let json = UserDefaults(suiteName: KonoShared.appGroup)?.string(forKey: KonoShared.snapshotKey),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(KonoSnapshot.self, from: data)
    }

    static let preview = KonoSnapshot(updated: "", name: "Sam",
        next: [Next(title: "Lab report", why: "It’s due today."), Next(title: "Study for Cell quiz", why: "The test is tomorrow.")],
        today: Today(done: 2, left: 3), kono: Kono(mood: "happy", line: "Two done already!", full: 80, happy: 90, asleep: false))
}

struct KonoEntry: TimelineEntry {
    let date: Date
    let snapshot: KonoSnapshot?
}

struct KonoProvider: TimelineProvider {
    func placeholder(in context: Context) -> KonoEntry { KonoEntry(date: Date(), snapshot: .preview) }
    func getSnapshot(in context: Context, completion: @escaping (KonoEntry) -> Void) {
        completion(KonoEntry(date: Date(), snapshot: context.isPreview ? .preview : KonoSnapshot.load() ?? .preview))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<KonoEntry>) -> Void) {
        // The app asks for a redraw whenever the plan changes; this refresh is a fallback.
        let entry = KonoEntry(date: Date(), snapshot: KonoSnapshot.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

let konoPink = Color(red: 0.88, green: 0.38, blue: 0.48)
let konoInk = Color(red: 0.31, green: 0.22, blue: 0.25)

func moodEmoji(_ k: KonoSnapshot.Kono) -> String {
    if k.asleep { return "😴" }
    switch k.mood {
    case "celebrate": return "🥳"
    case "happy": return "😊"
    case "sleepy": return "🥱"
    case "worried": return "😟"
    case "busy": return "📖"
    default: return "🍵"
    }
}

/// A small picture of KONO if the widget has one in its assets (named "kono"), else the mood emoji.
struct KonoPicture: View {
    let kono: KonoSnapshot.Kono
    var body: some View {
        if UIImage(named: "kono") != nil {
            Image("kono").resizable().interpolation(.none).scaledToFit()
        } else {
            Text(moodEmoji(kono)).font(.system(size: 34))
        }
    }
}

struct NextUpView: View {
    @Environment(\.widgetFamily) var family
    let entry: KonoEntry
    var body: some View {
        if let s = entry.snapshot {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Next up").font(.caption.bold()).foregroundStyle(konoPink)
                    Spacer()
                    Text("\(s.today.done) done · \(s.today.left) left").font(.caption2).foregroundStyle(.secondary)
                }
                if s.next.isEmpty {
                    Text("All caught up 🎉").font(.headline).foregroundStyle(konoInk)
                } else {
                    ForEach(Array(s.next.prefix(family == .systemSmall ? 1 : 3).enumerated()), id: \.offset) { i, n in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(n.title).font(i == 0 ? .headline : .subheadline).foregroundStyle(konoInk).lineLimit(2)
                            if i == 0 || family != .systemSmall { Text(n.why).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        } else {
            Text("Open KONO once to set up this widget.").font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct KonoMoodView: View {
    let entry: KonoEntry
    var body: some View {
        if let k = entry.snapshot?.kono {
            VStack(spacing: 6) {
                KonoPicture(kono: k).frame(height: 54)
                Text(k.line).font(.caption).multilineTextAlignment(.center).foregroundStyle(konoInk).lineLimit(3)
                HStack(spacing: 8) {
                    Label("\(k.full)%", systemImage: "fork.knife").font(.caption2)
                    Label("\(k.happy)%", systemImage: "heart.fill").font(.caption2)
                }.foregroundStyle(konoPink)
            }
        } else {
            Text("Open KONO once to set up this widget.").font(.caption).foregroundStyle(.secondary)
        }
    }
}

extension View {
    func konoBackground() -> some View {
        containerBackground(Color(red: 0.98, green: 0.95, blue: 0.92), for: .widget)
    }
}

struct NextUpWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KonoNextUp", provider: KonoProvider()) { entry in
            NextUpView(entry: entry).konoBackground().widgetURL(URL(string: "kono://planner"))
        }
        .configurationDisplayName("Next up")
        .description("What to work on next, from your KONO plan.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct KonoMoodWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KonoMood", provider: KonoProvider()) { entry in
            KonoMoodView(entry: entry).konoBackground().widgetURL(URL(string: "kono://kono"))
        }
        .configurationDisplayName("KONO")
        .description("How KONO is doing.")
        .supportedFamilies([.systemSmall])
    }
}

struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusAttributes.self) { context in
            HStack(spacing: 12) {
                Text("🍵").font(.title)
                VStack(alignment: .leading) {
                    Text("Focus with KONO").font(.caption.bold()).foregroundStyle(konoPink)
                    Text(context.attributes.title).font(.headline).lineLimit(1)
                }
                Spacer()
                Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
                    .font(.title2.monospacedDigit().bold()).frame(width: 84, alignment: .trailing)
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.98, green: 0.95, blue: 0.92))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text("🍵").font(.title2) }
                DynamicIslandExpandedRegion(.center) { Text(context.attributes.title).font(.headline).lineLimit(1) }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date()...context.state.endsAt, countsDown: true).monospacedDigit().frame(width: 64)
                }
            } compactLeading: {
                Text("🍵")
            } compactTrailing: {
                Text(timerInterval: Date()...context.state.endsAt, countsDown: true).monospacedDigit().frame(width: 44)
            } minimal: {
                Text("🍵")
            }
        }
    }
}

@main
struct KonoWidgets: WidgetBundle {
    @WidgetBundleBuilder var body: some Widget {
        NextUpWidget()
        KonoMoodWidget()
        FocusLiveActivity()
    }
}
