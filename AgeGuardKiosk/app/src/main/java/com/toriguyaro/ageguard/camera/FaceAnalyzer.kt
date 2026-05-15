package com.toriguyaro.ageguard.camera

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.Rect
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.toriguyaro.ageguard.ml.AgeEstimator
import com.toriguyaro.ageguard.ml.AgeResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

class FaceAnalyzer(
    private val ageEstimator: AgeEstimator,
    private val onFrame: (FrameEvent) -> Unit,
) : ImageAnalysis.Analyzer {

    sealed class FrameEvent {
        data object NoFace : FrameEvent()
        data object FaceScanning : FrameEvent()
        data class FaceDetected(val result: AgeResult) : FrameEvent()
    }

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            .setMinFaceSize(0.2f)
            .build()
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var lastInferenceMs = 0L
    private val inferring = AtomicBoolean(false)

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }
        val rotation = imageProxy.imageInfo.rotationDegrees
        val input = InputImage.fromMediaImage(mediaImage, rotation)

        detector.process(input)
            .addOnSuccessListener { faces ->
                if (faces.isEmpty()) {
                    onFrame(FrameEvent.NoFace)
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                val now = System.currentTimeMillis()
                if (now - lastInferenceMs < INFERENCE_INTERVAL_MS || !inferring.compareAndSet(false, true)) {
                    onFrame(FrameEvent.FaceScanning)
                    imageProxy.close()
                    return@addOnSuccessListener
                }
                lastInferenceMs = now

                val largest = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                if (largest == null) {
                    inferring.set(false)
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                val bitmap = imageProxy.toBitmap()
                imageProxy.close()
                val rotated = bitmap.rotate(rotation.toFloat())
                val cropped = rotated.cropSafe(largest.boundingBox)

                scope.launch {
                    try {
                        val result = ageEstimator.estimate(cropped)
                        onFrame(FrameEvent.FaceDetected(result))
                    } finally {
                        inferring.set(false)
                    }
                }
            }
            .addOnFailureListener {
                imageProxy.close()
            }
    }

    private fun Bitmap.rotate(degrees: Float): Bitmap {
        if (degrees == 0f) return this
        val m = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(this, 0, 0, width, height, m, true)
    }

    private fun Bitmap.cropSafe(rect: Rect): Bitmap {
        val left = rect.left.coerceIn(0, width - 1)
        val top = rect.top.coerceIn(0, height - 1)
        val right = rect.right.coerceIn(left + 1, width)
        val bottom = rect.bottom.coerceIn(top + 1, height)
        return Bitmap.createBitmap(this, left, top, right - left, bottom - top)
    }

    companion object {
        private const val INFERENCE_INTERVAL_MS = 500L
    }
}
