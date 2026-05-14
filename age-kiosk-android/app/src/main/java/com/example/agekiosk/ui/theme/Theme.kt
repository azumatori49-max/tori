package com.example.agekiosk.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF7AB6FF),
    background = Color(0xFF000000),
    surface = Color(0xFF111111),
    onBackground = Color.White,
)

@Composable
fun AgeKioskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else DarkColors,
        typography = MaterialTheme.typography,
        content = content,
    )
}
