package app.paintmate.app.plugins;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import app.paintmate.app.ARMeasurementActivity;

@CapacitorPlugin(name = "ARMeasurement")
public class ARMeasurementPlugin extends Plugin {

    @PluginMethod
    public void startScanning(PluginCall call) {
        android.util.Log.d("ARMeasurementPlugin", "startScanning called");
        try {
            Intent intent = new Intent(getContext(), ARMeasurementActivity.class);
            startActivityForResult(call, intent, "handleARResult");
            android.util.Log.d("ARMeasurementPlugin", "Activity started");
        } catch (Exception e) {
            android.util.Log.e("ARMeasurementPlugin", "Error starting activity", e);
            call.reject("Failed to start AR Activity: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleARResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() == android.app.Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            JSObject ret = new JSObject();
            ret.put("length", data.getFloatExtra("length", 0));
            ret.put("width", data.getFloatExtra("width", 0));
            ret.put("height", data.getFloatExtra("height", 0));
            ret.put("name", data.getStringExtra("name"));
            call.resolve(ret);
        } else {
            call.reject("AR Scanning cancelled or failed");
        }
    }
}
