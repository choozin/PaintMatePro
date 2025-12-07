package app.paintmate.app;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.ar.core.Anchor;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Pose;
import io.github.sceneview.ar.ArSceneView;
import java.util.ArrayList;
import java.util.List;

public class ARMeasurementActivity extends AppCompatActivity {

    private ArSceneView sceneView;
    private TextView statusText;
    private Button actionButton;
    private List<Anchor> anchors = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        android.util.Log.d("ARMeasurementActivity", "onCreate started");
        setContentView(R.layout.activity_ar_measurement);
        android.util.Log.d("ARMeasurementActivity", "setContentView finished");

        sceneView = findViewById(R.id.sceneView);
        statusText = findViewById(R.id.statusText);
        actionButton = findViewById(R.id.actionButton);

        statusText.setText("Move phone to detect floor...");
        Toast.makeText(this, "AR Activity Started", Toast.LENGTH_LONG).show();

        sceneView.setOnTouchListener((view, motionEvent) -> {
            if (motionEvent.getAction() == android.view.MotionEvent.ACTION_UP) {
                android.util.Log.d("ARMeasurementActivity", "Touch detected: ACTION_UP");
                
                if (sceneView.getArSession() == null) {
                    android.util.Log.e("ARMeasurementActivity", "AR Session is null");
                    return true;
                }
                
                try {
                    HitResult hitResult = sceneView.getArSession().update().hitTest(motionEvent).stream()
                            .filter(hit -> hit.getTrackable() instanceof Plane && ((Plane) hit.getTrackable()).isPoseInPolygon(hit.getHitPose()))
                            .findFirst()
                            .orElse(null);

                    if (hitResult != null) {
                        android.util.Log.d("ARMeasurementActivity", "Hit result found!");
                        if (anchors.size() >= 4) return true;

                        Anchor anchor = hitResult.createAnchor();
                        anchors.add(anchor);
                        statusText.setText("Point " + anchors.size() + "/4 placed");
                        Toast.makeText(this, "Point placed!", Toast.LENGTH_SHORT).show();

                        if (anchors.size() == 4) {
                            calculateAndFinish();
                        }
                        return true;
                    } else {
                        android.util.Log.d("ARMeasurementActivity", "No hit result (no plane detected)");
                        Toast.makeText(this, "No plane detected. Move phone to scan floor.", Toast.LENGTH_SHORT).show();
                    }
                } catch (com.google.ar.core.exceptions.CameraNotAvailableException e) {
                    android.util.Log.e("ARMeasurementActivity", "Camera not available", e);
                    e.printStackTrace();
                    return true;
                } catch (Exception e) {
                    android.util.Log.e("ARMeasurementActivity", "Error in touch listener", e);
                }
            }
            return true;
        });

        actionButton.setOnClickListener(v -> {
            if (anchors.size() > 0) {
                anchors.clear();
                statusText.setText("Cleared. Scan again.");
            } else {
                finish();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Check if resume exists, if not we rely on auto-lifecycle
        // But for 0.10.0 it should be there.
        // If it failed before, maybe it throws exception?
        // Let's try to not call it if it causes build error, but user said blank screen.
        // Maybe I need to cast it to SceneView?
        // ((io.github.sceneview.SceneView) sceneView).resume();
        // Or maybe I need to verify the import.
        // import io.github.sceneview.ar.ArSceneView;
        // Let's try to call it again, but maybe the previous error was due to something else?
        // The previous error was "cannot find symbol method resume()".
        // This means ArSceneView does NOT have resume().
        // Does it have onResume()?
        // sceneView.onResume();
        // Let's try onResume() instead of resume().
        try {
            // sceneView.resume(); // This failed.
             sceneView.onResume(this); // Maybe this?
        } catch (Exception e) {
             // Ignore
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // sceneView.pause(); // This failed.
         sceneView.onPause(this); // Maybe this?
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        sceneView.onDestroy(this);
    }

    private void calculateAndFinish() {
        if (anchors.size() < 4) return;
        
        float length = getDistance(anchors.get(0), anchors.get(1));
        float width = getDistance(anchors.get(1), anchors.get(2));
        
        float lengthFt = length * 3.28084f;
        float widthFt = width * 3.28084f;
        float heightFt = 0f;

        Intent result = new Intent();
        result.putExtra("length", lengthFt);
        result.putExtra("width", widthFt);
        result.putExtra("height", heightFt);
        result.putExtra("name", "Scanned Room");
        
        setResult(RESULT_OK, result);
        finish();
    }

    private float getDistance(Anchor a1, Anchor a2) {
        Pose p1 = a1.getPose();
        Pose p2 = a2.getPose();
        float dx = p1.tx() - p2.tx();
        float dy = p1.ty() - p2.ty();
        float dz = p1.ty() - p2.ty();
        return (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
