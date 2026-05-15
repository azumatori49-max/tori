package com.example.agekiosk.vision

import android.graphics.RectF
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class DetectedFace(
    /** ピクセル座標系の顔の bounding box (回転適用後の画像座標) */
    val box: RectF,
    val yawDeg: Float,
    val pitchDeg: Float,
    val rollDeg: Float,
)

class FaceDetector {
    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            // TECLAST の前面カメラは 2-5MP と低解像度なため、顔が小さく
            // 映りやすい。やや緩めに設定する。
            .setMinFaceSize(0.15f)
            .build()
    )

    suspend fun detect(image: ImageProxy): List<DetectedFace> =
        suspendCancellableCoroutine { cont ->
            val mediaImage = image.image
            if (mediaImage == null) {
                cont.resume(emptyList())
                return@suspendCancellableCoroutine
            }
            val rotation = image.imageInfo.rotationDegrees
            val input = InputImage.fromMediaImage(mediaImage, rotation)

            detector.process(input)
                .addOnSuccessListener { faces -> cont.resume(faces.map(Companion::toDetected)) }
                .addOnFailureListener { e -> cont.resumeWithException(e) }
        }

    fun close() = detector.close()

    companion object {
        private fun toDetected(face: Face): DetectedFace = DetectedFace(
            box = RectF(face.boundingBox),
            yawDeg = face.headEulerAngleY,
            pitchDeg = face.headEulerAngleX,
            rollDeg = face.headEulerAngleZ,
        )
    }
}
