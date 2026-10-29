package app.kono.study;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** KONO's bridge to the home-screen widget (src/native.ts calls it as KonoWidget). The focus Live
 * Activity is iPhone-only, so startFocus/endFocus do nothing here. */
@CapacitorPlugin(name = "KonoWidget")
public class KonoWidgetPlugin extends Plugin {
    static final String PREFS = "kono_widget";
    static final String SNAPSHOT = "snapshot";

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.length() > 20000) {
            call.reject("No widget data");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SNAPSHOT, json).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, KonoWidgetProvider.class));
        if (ids.length > 0) {
            Intent update = new Intent(context, KonoWidgetProvider.class);
            update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(update);
        }
        call.resolve();
    }

    @PluginMethod
    public void startFocus(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void endFocus(PluginCall call) { call.resolve(); }
}
