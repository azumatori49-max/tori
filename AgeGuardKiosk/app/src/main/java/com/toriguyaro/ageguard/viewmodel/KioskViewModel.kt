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
import kotlin.math.abs

enum class UiState { WAITING, DETECTING, RESULT, NO_FACE }

data class KioskUi(
    val state: UiState = UiState.WAITING,
    val age: Int? = null,
)

class KioskViewModel : ViewModel() {

    private val _ui = MutableStateFlow(KioskUi())
    val ui: StateFlow<KioskUi> = _ui.asStateFlow()

    private var leaveJob: Job? = null
    private val recentAges = ArrayDeque<Int>()
    private var displayedAge: Int? = null

    fun reset() {
        leaveJob?.cancel()
        recentAges.clear()
        displayedAge = null
        _ui.value = KioskUi(state = UiState.WAITING)
    }

    fun onFrame(event: FaceAnalyzer.FrameEvent) {
        when (event) {
            FaceAnalyzer.FrameEvent.NoFace -> handleNoFace()
            FaceAnalyzer.FrameEvent.FaceScanning -> handleScanning()
            is FaceAnalyzer.FrameEvent.FaceDetected -> handleFace(event.result)
        }
    }

    private fun handleScanning() {
        // Face is present but inference is throttled — cancel any pending leave timer.
        leaveJob?.cancel()
        if (_ui.value.state == UiState.WAITING || _ui.value.state == UiState.NO_FACE) {
            _ui.value = _ui.value.copy(state = UiState.DETECTING)
        }
    }

    private fun handleNoFace() {
        // Don't immediately reset — give the user a grace period in case the
        // face momentarily leaves the frame.
        if (leaveJob?.isActive == true) return
        leaveJob = viewModelScope.launch {
            delay(LEAVE_GRACE_MS)
            recentAges.clear()
            displayedAge = null
            _ui.value = KioskUi(state = UiState.WAITING)
        }
    }

    private fun handleFace(result: AgeResult) {
        leaveJob?.cancel()

        if (result.confidence < MIN_CONFIDENCE || result.estimatedAge == null) {
            // Low-confidence frame — keep showing previous value if any.
            if (displayedAge == null) {
                _ui.value = KioskUi(state = UiState.RESULT, age = null)
            }
            return
        }

        val sample = result.estimatedAge
        recentAges.addLast(sample)
        while (recentAges.size > WINDOW_SIZE) recentAges.removeFirst()

        // Don't commit a value until we have enough samples — avoids showing
        // the first noisy estimates while the median window fills up.
        if (recentAges.size < WARMUP_SAMPLES) {
            if (displayedAge == null) {
                _ui.value = KioskUi(state = UiState.DETECTING, age = null)
            }
            return
        }

        val smoothed = median(recentAges)

        // Hysteresis: only update displayed age when the smoothed value drifts
        // far enough from the previous display. Stops 1-2-year flicker.
        val current = displayedAge
        val next = when {
            current == null -> smoothed
            abs(smoothed - current) >= UPDATE_THRESHOLD -> smoothed
            else -> current
        }
        displayedAge = next
        _ui.value = KioskUi(state = UiState.RESULT, age = next)
    }

    private fun median(values: Collection<Int>): Int {
        val sorted = values.sorted()
        val n = sorted.size
        return if (n % 2 == 1) sorted[n / 2]
        else ((sorted[n / 2 - 1] + sorted[n / 2]) / 2)
    }

    companion object {
        private const val LEAVE_GRACE_MS = 1500L
        private const val MIN_CONFIDENCE = 0.2f
        private const val WINDOW_SIZE = 15
        private const val UPDATE_THRESHOLD = 3
        private const val WARMUP_SAMPLES = 6
    }
}
