package com.toriguyaro.ageguard.ui

import android.view.ViewGroup
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.toriguyaro.ageguard.R
import com.toriguyaro.ageguard.camera.CameraManager
import com.toriguyaro.ageguard.viewmodel.KioskUi
import com.toriguyaro.ageguard.viewmodel.UiState

// ----- Theme colors -----
private val Cyan = Color(0xFF22D3EE)
private val CardBg = Color(0xE6111827)          // frosted dark
private val Muted = Color(0xFF94A3B8)

@Composable
fun KioskScreen(
    ui: KioskUi,
    cameraManagerFactory: () -> CameraManager,
    isMockMode: Boolean = false,
    onTap: () -> Unit = {},
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraManager = remember { cameraManagerFactory() }
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onTap,
            )
    ) {
        // Camera preview
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

        // Top + bottom gradient scrim for legibility
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color(0xCC000000),
                        0.25f to Color(0x00000000),
                        0.55f to Color(0x00000000),
                        1f to Color(0xF2000000),
                    )
                )
        )

        FaceOverlay(state = ui.state, modifier = Modifier.fillMaxSize())

        // ---- Top brand bar ----
        BrandBar(
            ui = ui,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 22.dp),
        )

        if (isMockMode) {
            DemoBadge(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 64.dp, end = 24.dp)
            )
        }

        // ---- Bottom result card ----
        ResultCard(
            ui = ui,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
        )
    }
}

@Composable
private fun BrandBar(ui: KioskUi, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Logo mark
        Box(
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(Cyan, Color(0xFF3B82F6)))),
            contentAlignment = Alignment.Center,
        ) {
            Text("A", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                stringResource(R.string.brand_name),
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                stringResource(R.string.brand_subtitle),
                color = Muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
        }
        Spacer(Modifier.weight(1f))
        // Live status dot
        val live = ui.state == UiState.DETECTING || ui.state == UiState.RESULT
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(if (live) Cyan else Muted.copy(alpha = 0.5f))
        )
    }
}

@Composable
private fun ResultCard(ui: KioskUi, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(28.dp))
            .background(CardBg)
            .padding(horizontal = 28.dp, vertical = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Guide / status line
        val guide = when (ui.state) {
            UiState.NO_FACE -> stringResource(R.string.no_face)
            UiState.DETECTING -> stringResource(R.string.guide_scanning)
            UiState.RESULT -> stringResource(R.string.age_prefix)
            else -> stringResource(R.string.guide_align_face)
        }
        Text(
            guide,
            color = Muted,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
        )

        Spacer(Modifier.height(4.dp))

        // Big age number
        val showAge = ui.state == UiState.RESULT && ui.age != null
        val digits = if (showAge) ui.age.toString()
        else if (ui.state == UiState.DETECTING) "··"
        else stringResource(R.string.age_unknown)
        val numberColor = if (showAge) Color.White else Muted

        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                digits,
                color = numberColor,
                fontSize = 116.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                " ${stringResource(R.string.age_unit)}",
                color = numberColor,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 22.dp),
            )
        }

        // Status pill removed — show number only.

        Spacer(Modifier.height(14.dp))

        Text(
            stringResource(
                R.string.reliability_caption,
                stringResource(R.string.training_data_count),
            ),
            color = Muted,
            fontSize = 13.sp,
            modifier = Modifier.alpha(0.8f),
        )
        Text(
            stringResource(R.string.disclaimer),
            color = Muted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .alpha(0.6f)
                .padding(top = 2.dp),
        )
    }
}

@Composable
private fun DemoBadge(modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFFEF4444))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            "DEMO・モデル未配置",
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}
