package com.toriguyaro.ageguard.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.toriguyaro.ageguard.camera.FaceAnalyzer
import com.toriguyaro.ageguard.ml.AgeResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class UiState { WAITING, DETECTING, RESULT, NO_FACE }

data class KioskUi(
    val state: UiState = UiState.WAITING,
    val age: Int? = null,
)

class KioskViewModel : ViewModel() {

    private val _ui = MutableStateFlow(KioskUi())
    val ui: StateFlow<KioskUi> = _ui.asStateFlow()

    private var resetJob: Job? = null
    private var lastNoFaceMs: Long = 0L

    fun onFrame(event: FaceAnalyzer.FrameEvent) {
        when (event) {
            FaceAnalyzer.FrameEvent.NoFace -> handleNoFace()
            FaceAnalyzer.FrameEvent.FaceScanning -> handleScanning()
            is FaceAnalyzer.FrameEvent.FaceDetected -> handleFace(event.result)
        }
    }

    private fun handleScanning() {
        if (_ui.value.state == UiState.WAITING) {
            _ui.value = _ui.value.copy(state = UiState.DETECTING)
        }
    }

    private fun handleNoFace() {
        // Only transition to NO_FACE/WAITING when not currently displaying a result.
        if (_ui.value.state == UiState.RESULT) return
        // Debounce slight flicker
        val now = System.currentTimeMillis()
        if (now - lastNoFaceMs < 300) return
        lastNoFaceMs = now
        _ui.value = KioskUi(state = UiState.WAITING)
    }

    private fun handleFace(result: AgeResult) {
        resetJob?.cancel()
        val age = if (result.confidence >= MIN_CONFIDENCE) result.estimatedAge else null
        _ui.value = KioskUi(state = UiState.RESULT, age = age)

        resetJob = viewModelScope.launch {
            delay(RESET_DELAY_MS)
            _ui.value = KioskUi(state = UiState.WAITING)
        }
    }

    companion object {
        private const val RESET_DELAY_MS = 2000L
        private const val MIN_CONFIDENCE = 0.2f
    }
}
