package com.toriguyaro.ageguard.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import com.toriguyaro.ageguard.viewmodel.UiState

@Composable
fun FaceOverlay(
    state: UiState,
    modifier: Modifier = Modifier,
) {
    val cyan = Color(0xFF00E5FF)

    val infinite = rememberInfiniteTransition(label = "overlay")
    val blink by infinite.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "blink",
    )
    val scan by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "scan",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        val isPortrait = size.height >= size.width
        val baseDim = minOf(size.width, size.height)
        val frameWidth = baseDim * if (isPortrait) 0.7f else 0.45f
        val frameHeight = frameWidth * 1.25f
        val verticalBias = if (isPortrait) 0.18f else 0.05f
        val left = (size.width - frameWidth) / 2f
        val top = (size.height - frameHeight) / 2f - size.height * verticalBias
        val topLeft = Offset(left, top)
        val frameSize = Size(frameWidth, frameHeight)

        val color = when (state) {
            UiState.WAITING, UiState.NO_FACE -> Color.White.copy(alpha = blink)
            UiState.DETECTING, UiState.RESULT -> cyan
        }

        drawCornerBrackets(topLeft, frameSize, color, strokeWidth = 6.dp.toPx())

        if (state == UiState.DETECTING) {
            val y = top + frameHeight * scan
            drawLine(
                color = cyan.copy(alpha = 0.85f),
                start = Offset(left + 8.dp.toPx(), y),
                end = Offset(left + frameWidth - 8.dp.toPx(), y),
                strokeWidth = 3.dp.toPx(),
                cap = StrokeCap.Round,
            )
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawCornerBrackets(
    topLeft: Offset,
    size: Size,
    color: Color,
    strokeWidth: Float,
) {
    val len = minOf(size.width, size.height) * 0.18f

    val x0 = topLeft.x
    val y0 = topLeft.y
    val x1 = topLeft.x + size.width
    val y1 = topLeft.y + size.height

    // top-left
    drawLine(color, Offset(x0, y0), Offset(x0 + len, y0), strokeWidth, cap = StrokeCap.Round)
    drawLine(color, Offset(x0, y0), Offset(x0, y0 + len), strokeWidth, cap = StrokeCap.Round)
    // top-right
    drawLine(color, Offset(x1, y0), Offset(x1 - len, y0), strokeWidth, cap = StrokeCap.Round)
    drawLine(color, Offset(x1, y0), Offset(x1, y0 + len), strokeWidth, cap = StrokeCap.Round)
    // bottom-left
    drawLine(color, Offset(x0, y1), Offset(x0 + len, y1), strokeWidth, cap = StrokeCap.Round)
    drawLine(color, Offset(x0, y1), Offset(x0, y1 - len), strokeWidth, cap = StrokeCap.Round)
    // bottom-right
    drawLine(color, Offset(x1, y1), Offset(x1 - len, y1), strokeWidth, cap = StrokeCap.Round)
    drawLine(color, Offset(x1, y1), Offset(x1, y1 - len), strokeWidth, cap = StrokeCap.Round)
}
