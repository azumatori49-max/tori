package com.example.agekiosk.model

import android.app.Application
import android.os.SystemClock
import androidx.camera.core.ImageProxy
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.agekiosk.vision.AgeEstimator
import com.example.agekiosk.vision.AgeSmoother
import com.example.agekiosk.vision.FaceDetector
import com.example.agekiosk.vision.JapaneseCalibrator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface KioskState {
    data object Waiting : KioskState
    data class Scanning(val progress: Float) : KioskState
    data class Result(val age: Int) : KioskState
    data object NoModel : KioskState
}

class KioskViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow<KioskState>(KioskState.Waiting)
    val state: StateFlow<KioskState> = _state.asStateFlow()

    /** プレビュー (正規化 0..1) 座標系の顔矩形。null なら描かない。 */
    private val _faceBox = MutableStateFlow<android.graphics.RectF?>(null)
    val faceBox: StateFlow<android.graphics.RectF?> = _faceBox.asStateFlow()

    private val faceDetector = FaceDetector()
    private val estimator: AgeEstimator? = AgeEstimator.tryCreate(app.applicationContext)
    private val smoother = AgeSmoother(alpha = 0.35f)

    private val inferenceMutex = Mutex()
    private var lastInferenceMs = 0L
    private val inferenceIntervalMs = 1000L / 6  // 6fps で推論
    private var resultShownAt: Long = 0L
    private val resultHoldMs = 4000L

    init {
        if (estimator == null) {
            _state.value = KioskState.NoModel
        }
    }

    fun onFrame(image: ImageProxy) {
        val now = SystemClock.uptimeMillis()
        if (_state.value is KioskState.Result && now - resultShownAt > resultHoldMs) {
            resetToWaiting()
        }
        if (now - lastInferenceMs < inferenceIntervalMs || estimator == null) {
            image.close(); return
        }
        lastInferenceMs = now

        viewModelScope.launch {
            if (!inferenceMutex.tryLock()) { image.close(); return@launch }
            try {
                process(image)
            } finally {
                inferenceMutex.unlock()
                image.close()
            }
        }
    }

    private suspend fun process(image: ImageProxy) {
        val width = image.width
        val height = image.height
        val faces = runCatching { faceDetector.detect(image) }.getOrNull().orEmpty()

        val face = faces.maxByOrNull { it.box.width() }
        if (face == null || face.box.width() < width * 0.18f) {
            _faceBox.value = null
            if (_state.value is KioskState.Result) return
            smoother.reset()
            _state.value = KioskState.Waiting
            return
        }

        // 検出座標系 (画像ピクセル) → 0..1 正規化
        _faceBox.value = android.graphics.RectF(
            face.box.left / width,
            face.box.top / height,
            face.box.right / width,
            face.box.bottom / height,
        )

        if (_state.value is KioskState.Result) return

        val raw = estimator?.estimate(image, face.box) ?: return
        if (raw.isNaN()) return

        val calibrated = JapaneseCalibrator.calibrate(raw)
        val weight = JapaneseCalibrator.weight(face.yawDeg, face.pitchDeg, face.rollDeg)
        val smoothed = smoother.update(calibrated, weight)

        _state.value = if (smoother.isStable) {
            resultShownAt = SystemClock.uptimeMillis()
            KioskState.Result(smoothed.toInt())
        } else {
            KioskState.Scanning(if (smoother.value != null) 0.7f else 0.3f)
        }
    }

    fun resetToWaiting() {
        smoother.reset()
        resultShownAt = 0
        _state.value = KioskState.Waiting
        _faceBox.value = null
    }

    override fun onCleared() {
        super.onCleared()
        faceDetector.close()
        estimator?.close()
    }
}
