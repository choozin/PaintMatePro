package app.paintmate.app;

import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(app.paintmate.app.plugins.ARMeasurementPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onStart() {
      super.onStart();
      WebView webView = getBridge().getWebView();
      webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
          @Override
          public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
              // Ignore SSL errors for the local server
              handler.proceed();
          }
      });
  }
}
