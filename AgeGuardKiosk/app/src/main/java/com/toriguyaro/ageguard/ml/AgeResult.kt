package com.toriguyaro.ageguard.ml

data class AgeResult(
    val estimatedAge: Int?,
    val confidence: Float,
)
