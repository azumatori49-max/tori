package com.toriguyaro.ageguard.ui

import androidx.compose.animation.animateColorAsState
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.toriguyaro.ageguard.viewmodel.UiState

private val OverlayCyan = Color(0xFF22D3EE)
private val statusColors = listOf(
    OverlayCyan,             // 0 = none
    Color(0xFFF43F5E),       // 1 = minor (red)
    Color(0xFFF59E0B),       // 2 = boundary (amber)
    Color(0xFF22C55E),       // 3 = adult (green)
)

@Composable
fun FaceOverlay(
    state: UiState,
    status: Int = 0,
    modifier: Modifier = Modifier,
) {
    val infinite = rememberInfiniteTransition(label = "overlay")
    val pulse by infinite.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse),
        label = "pulse",
    )
    val scan by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Reverse),
        label = "scan",
    )

    val targetColor = when (state) {
        UiState.WAITING, UiState.NO_FACE -> Color.White
        UiState.DETECTING -> OverlayCyan
        UiState.RESULT -> statusColors.getOrElse(status) { OverlayCyan }
    }
    val frameColor by animateColorAsState(targetColor, tween(400), label = "frame")

    Canvas(modifier = modifier.fillMaxSize()) {
        val isPortrait = size.height >= size.width
        val baseDim = minOf(size.width, size.height)
        val frameWidth = baseDim * if (isPortrait) 0.7f else 0.5f
        val frameHeight = frameWidth * 1.22f
        val verticalBias = if (isPortrait) 0.16f else 0.0f
        // In landscape the result card sits on the right, so nudge the frame left.
        val horizontalBias = if (isPortrait) 0f else -size.width * 0.14f
        val left = (size.width - frameWidth) / 2f + horizontalBias
        val top = (size.height - frameHeight) / 2f - size.height * verticalBias
        val topLeft = Offset(left, top)
        val frameSize = Size(frameWidth, frameHeight)
        val radius = 28.dp.toPx()

        val alpha = when (state) {
            UiState.WAITING, UiState.NO_FACE -> pulse
            else -> 1f
        }

        // Faint full rounded rectangle guide
        drawRoundRect(
            color = frameColor.copy(alpha = 0.18f * alpha + 0.08f),
            topLeft = topLeft,
            size = frameSize,
            cornerRadius = CornerRadius(radius, radius),
            style = Stroke(width = 2.dp.toPx()),
        )

        // Bold corner brackets
        drawCornerBrackets(
            topLeft, frameSize,
            color = frameColor.copy(alpha = alpha),
            strokeWidth = 7.dp.toPx(),
            corner = radius,
        )

        // Scan line while detecting
        if (state == UiState.DETECTING) {
            val y = top + frameHeight * scan
            drawLine(
                color = OverlayCyan.copy(alpha = 0.9f),
                start = Offset(left + 14.dp.toPx(), y),
                end = Offset(left + frameWidth - 14.dp.toPx(), y),
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
    corner: Float,
) {
    val len = minOf(size.width, size.height) * 0.16f
    val x0 = topLeft.x
    val y0 = topLeft.y
    val x1 = topLeft.x + size.width
    val y1 = topLeft.y + size.height

    fun line(a: Offset, b: Offset) =
        drawLine(color, a, b, strokeWidth, cap = StrokeCap.Round)

    // top-left
    line(Offset(x0, y0 + corner + len), Offset(x0, y0 + corner))
    line(Offset(x0 + corner, y0), Offset(x0 + corner + len, y0))
    // top-right
    line(Offset(x1, y0 + corner + len), Offset(x1, y0 + corner))
    line(Offset(x1 - corner, y0), Offset(x1 - corner - len, y0))
    // bottom-left
    line(Offset(x0, y1 - corner - len), Offset(x0, y1 - corner))
    line(Offset(x0 + corner, y1), Offset(x0 + corner + len, y1))
    // bottom-right
    line(Offset(x1, y1 - corner - len), Offset(x1, y1 - corner))
    line(Offset(x1 - corner, y1), Offset(x1 - corner - len, y1))
}
