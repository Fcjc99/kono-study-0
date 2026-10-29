package app.kono.study;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** KONO's home-screen widget: what's next up, today's count and how KONO is doing. The app writes the
 * data (src/store/nativeBridge.ts WidgetSnapshot) through KonoWidgetPlugin; this only draws it. */
public class KonoWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        String json = context.getSharedPreferences(KonoWidgetPlugin.PREFS, Context.MODE_PRIVATE).getString(KonoWidgetPlugin.SNAPSHOT, null);
        for (int id : ids) manager.updateAppWidget(id, views(context, json));
    }

    static RemoteViews views(Context context, String json) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.kono_widget);
        Intent open = new Intent(context, MainActivity.class);
        v.setOnClickPendingIntent(R.id.kono_widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        int[] lines = {R.id.kono_widget_next1, R.id.kono_widget_next2, R.id.kono_widget_next3};
        try {
            if (json == null) throw new IllegalStateException("no data yet");
            JSONObject s = new JSONObject(json);
            JSONObject today = s.getJSONObject("today"), kono = s.getJSONObject("kono");
            v.setTextViewText(R.id.kono_widget_count, today.getInt("done") + " done · " + today.getInt("left") + " left");
            JSONArray next = s.getJSONArray("next");
            for (int i = 0; i < lines.length; i++) {
                v.setTextViewText(lines[i], i < next.length() ? next.getJSONObject(i).getString("title") : (i == 0 ? "All caught up 🎉" : ""));
            }
            v.setTextViewText(R.id.kono_widget_kono, (kono.getBoolean("asleep") ? "😴 " : "🍵 ") + kono.getString("line"));
        } catch (Exception e) {
            v.setTextViewText(R.id.kono_widget_count, "");
            v.setTextViewText(lines[0], "Open KONO once to set up this widget.");
            v.setTextViewText(lines[1], "");
            v.setTextViewText(lines[2], "");
            v.setTextViewText(R.id.kono_widget_kono, "");
        }
        return v;
    }
}
