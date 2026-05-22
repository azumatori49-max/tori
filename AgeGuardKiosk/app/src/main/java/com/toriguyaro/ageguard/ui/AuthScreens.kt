package com.toriguyaro.ageguard.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.toriguyaro.ageguard.R

private val BgTop = Color(0xFF0B1220)
private val BgBottom = Color(0xFF111827)
private val Accent = Color(0xFF22D3EE)
private val AccentBlue = Color(0xFF3B82F6)
private val MutedText = Color(0xFF94A3B8)

@Composable
private fun authBackground(): Modifier = Modifier
    .fillMaxSize()
    .background(Brush.verticalGradient(listOf(BgTop, BgBottom)))

@Composable
fun LogoMark(size: Int = 84) {
    Image(
        painter = painterResource(R.drawable.app_logo),
        contentDescription = null,
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape((size / 4.5).dp)),
    )
}

@Composable
fun SplashScreen(onStart: () -> Unit) {
    Box(authBackground(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            LogoMark(96)
            Spacer(Modifier.height(28.dp))
            Text(
                stringResource(R.string.brand_name),
                color = Color.White,
                fontSize = 44.sp,
                fontWeight = FontWeight.Black,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.brand_subtitle),
                color = MutedText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(56.dp))

            // Start button
            val interaction = remember { MutableInteractionSource() }
            Box(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Brush.linearGradient(listOf(Accent, AccentBlue)))
                    .clickable(interaction, indication = null, onClick = onStart)
                    .padding(horizontal = 64.dp, vertical = 18.dp),
            ) {
                Text(
                    stringResource(R.string.start_button),
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.reliability_caption, "18"),
                color = MutedText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        Text(
            stringResource(R.string.disclaimer),
            color = MutedText,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp, start = 32.dp, end = 32.dp),
        )
    }
}

@Composable
fun PinScreen(
    correctPin: String,
    onSuccess: () -> Unit,
    onBack: () -> Unit,
) {
    var entered by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    fun append(d: String) {
        if (entered.length >= correctPin.length) return
        error = false
        entered += d
        if (entered.length == correctPin.length) {
            if (entered == correctPin) {
                onSuccess()
            } else {
                error = true
                entered = ""
            }
        }
    }

    fun backspace() {
        error = false
        if (entered.isNotEmpty()) entered = entered.dropLast(1)
    }

    Box(authBackground(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.widthIn(max = 360.dp).padding(24.dp),
        ) {
            LogoMark(56)
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.pin_title),
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (error) stringResource(R.string.pin_error)
                else stringResource(R.string.pin_subtitle),
                color = if (error) Color(0xFFF43F5E) else MutedText,
                fontSize = 14.sp,
            )
            Spacer(Modifier.height(28.dp))

            // PIN dots
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                repeat(correctPin.length) { i ->
                    val filled = i < entered.length
                    Box(
                        Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .background(if (filled) Accent else Color(0xFF334155))
                    )
                }
            }
            Spacer(Modifier.height(40.dp))

            // Keypad
            val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫")
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                keys.chunked(3).forEach { rowKeys ->
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        rowKeys.forEach { key ->
                            KeypadButton(
                                label = key,
                                onClick = {
                                    when (key) {
                                        "" -> {}
                                        "⌫" -> backspace()
                                        else -> append(key)
                                    }
                                },
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                stringResource(R.string.back),
                color = MutedText,
                fontSize = 15.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onBack)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun KeypadButton(label: String, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier
            .size(76.dp)
            .clip(CircleShape)
            .background(if (label.isEmpty()) Color.Transparent else Color(0x1AFFFFFF))
            .clickable(
                interaction,
                indication = null,
                enabled = label.isNotEmpty(),
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = Color.White,
            fontSize = if (label == "⌫") 26.sp else 30.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}
