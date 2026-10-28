package app.kono.study;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // KONO's own native plugin (the home-screen widget), before the web view starts.
        registerPlugin(KonoWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
