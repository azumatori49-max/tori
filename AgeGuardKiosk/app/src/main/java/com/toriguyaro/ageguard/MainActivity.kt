package com.toriguyaro.ageguard

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.toriguyaro.ageguard.camera.CameraManager
import com.toriguyaro.ageguard.camera.FaceAnalyzer
import com.toriguyaro.ageguard.ml.AgeEstimator
import com.toriguyaro.ageguard.ui.KioskScreen
import com.toriguyaro.ageguard.viewmodel.KioskViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: KioskViewModel by viewModels()
    private lateinit var ageEstimator: AgeEstimator
    private lateinit var faceAnalyzer: FaceAnalyzer

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        permissionGranted = granted
    }

    private var permissionGranted by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        ageEstimator = AgeEstimator(applicationContext)
        faceAnalyzer = FaceAnalyzer(ageEstimator) { event ->
            viewModel.onFrame(event)
        }

        permissionGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA,
        ) == PackageManager.PERMISSION_GRANTED

        if (!permissionGranted) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                val ui by viewModel.ui.collectAsState()
                val cameraManagerFactory = remember {
                    { CameraManager(applicationContext, faceAnalyzer) }
                }

                if (permissionGranted) {
                    KioskScreen(
                        ui = ui,
                        cameraManagerFactory = cameraManagerFactory,
                        isMockMode = ageEstimator.isMockMode,
                    )
                } else {
                    Box(
                        Modifier.fillMaxSize().background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "カメラの権限が必要です",
                            color = Color.White,
                            fontSize = 22.sp,
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::ageEstimator.isInitialized) ageEstimator.close()
    }
}
