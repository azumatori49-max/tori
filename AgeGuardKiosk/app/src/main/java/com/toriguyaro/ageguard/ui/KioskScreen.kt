package com.toriguyaro.ageguard.ui

import android.view.ViewGroup
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.toriguyaro.ageguard.R
import com.toriguyaro.ageguard.camera.CameraManager
import com.toriguyaro.ageguard.viewmodel.KioskUi
import com.toriguyaro.ageguard.viewmodel.UiState

@Composable
fun KioskScreen(
    ui: KioskUi,
    cameraManagerFactory: () -> CameraManager,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraManager = remember { cameraManagerFactory() }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                PreviewView(it).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    cameraManager.bind(lifecycleOwner, this)
                }
            },
        )

        FaceOverlay(state = ui.state, modifier = Modifier.fillMaxSize())

        // Top guide text
        Box(
            Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .padding(top = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            val guide = when (ui.state) {
                UiState.NO_FACE -> stringResource(R.string.no_face)
                else -> stringResource(R.string.guide_align_face)
            }
            Text(
                text = guide,
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        // Bottom age panel — about 1/3 of screen
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.33f)
                .background(Color(0xCC000000)),
            contentAlignment = Alignment.Center,
        ) {
            AgePanel(ui = ui)
        }
    }
}

@Composable
private fun AgePanel(ui: KioskUi) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .wrapContentHeight(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        val (digits, unit, digitColor) = when (ui.state) {
            UiState.RESULT -> {
                if (ui.age != null) {
                    Triple(ui.age.toString(), stringResource(R.string.age_unit), Color.White)
                } else {
                    Triple("--", stringResource(R.string.age_unit), Color(0xFFBDBDBD))
                }
            }
            UiState.DETECTING -> Triple("...", stringResource(R.string.age_unit), Color.White.copy(alpha = 0.6f))
            else -> Triple("--", stringResource(R.string.age_unit), Color(0xFFBDBDBD))
        }

        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                text = digits,
                color = digitColor,
                fontSize = 120.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                text = " $unit",
                color = digitColor,
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 18.dp),
            )
        }

        Text(
            text = stringResource(
                R.string.reliability_caption,
                stringResource(R.string.training_data_count),
            ),
            color = Color.White,
            fontSize = 16.sp,
            modifier = Modifier.alpha(0.6f),
        )
    }
}
