import UIKit
import Capacitor

/// The app's web view (Main.storyboard), with KONO's own native plugin added.
class KonoViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(KonoWidgetPlugin())
    }
}
