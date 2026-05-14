package com.example.agekiosk.vision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.YuvImage
import android.graphics.ImageFormat
import androidx.camera.core.ImageProxy
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import org.tensorflow.lite.nnapi.NnApiDelegate
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import org.tensorflow.lite.support.tensorbuffer.TensorBuffer
import java.io.ByteArrayOutputStream

/**
 * TFLite による年齢推定。
 *
 * 期待するモデル `age_net.tflite`:
 *  - 入力: float32 [1, 224, 224, 3], 値域 0..1 (正規化はモデル側 or 外側で吸収)
 *  - 出力のいずれか:
 *      * `age` 単一スカラー (float) — 回帰モデル
 *      * 101 要素 (0..100 歳の softmax) — DEX 型。期待値で年齢化
 *
 * NNAPI / GPU の delegate を順に試して使えるものを使う。
 * モデルは `app/src/main/assets/age_net.tflite` に置く。
 */
class AgeEstimator private constructor(
    private val interpreter: Interpreter,
    val inputSize: Int,
    private val numBuckets: Int?, // null なら回帰モデル
) {

    private val processor: ImageProcessor = ImageProcessor.Builder()
        .add(ResizeOp(inputSize, inputSize, ResizeOp.ResizeMethod.BILINEAR))
        .build()

    fun estimate(frame: ImageProxy, faceBox: RectF): Float {
        val cropped = cropFace(frame, faceBox) ?: return Float.NaN
        var tensor = TensorImage.fromBitmap(cropped)
        tensor = processor.process(tensor)

        val outputs = mutableMapOf<Int, Any>()
        val outShape = interpreter.getOutputTensor(0).shape()
        val outBuf = TensorBuffer.createFixedSize(outShape, interpreter.getOutputTensor(0).dataType())
        outputs[0] = outBuf.buffer.rewind()
        interpreter.runForMultipleInputsOutputs(arrayOf<Any>(tensor.buffer), outputs)

        val values = outBuf.floatArray
        return if (numBuckets != null) expectedAge(values) else values[0]
    }

    fun close() {
        interpreter.close()
    }

    private fun expectedAge(probs: FloatArray): Float {
        var num = 0.0
        var den = 0.0
        for (i in probs.indices) {
            num += i.toDouble() * probs[i]
            den += probs[i]
        }
        return if (den > 0) (num / den).toFloat() else Float.NaN
    }

    /** YUV ImageProxy から顔の bbox 領域を切り出してミラー反転 (フロントカメラ補正) した Bitmap を返す。 */
    private fun cropFace(image: ImageProxy, box: RectF): Bitmap? {
        val full = image.toBitmap() ?: return null
        val expanded = expandWithMargin(box, full.width, full.height, marginRatio = 0.25f)
        val w = (expanded.right - expanded.left).toInt().coerceAtLeast(1)
        val h = (expanded.bottom - expanded.top).toInt().coerceAtLeast(1)
        val matrix = Matrix().apply { postScale(-1f, 1f, w / 2f, h / 2f) } // mirror
        return Bitmap.createBitmap(
            full,
            expanded.left.toInt().coerceAtLeast(0),
            expanded.top.toInt().coerceAtLeast(0),
            w.coerceAtMost(full.width - expanded.left.toInt().coerceAtLeast(0)),
            h.coerceAtMost(full.height - expanded.top.toInt().coerceAtLeast(0)),
            matrix,
            true,
        )
    }

    private fun expandWithMargin(box: RectF, maxW: Int, maxH: Int, marginRatio: Float): RectF {
        val mx = box.width() * marginRatio
        val my = box.height() * marginRatio
        return RectF(
            (box.left - mx).coerceAtLeast(0f),
            (box.top - my).coerceAtLeast(0f),
            (box.right + mx).coerceAtMost(maxW.toFloat()),
            (box.bottom + my).coerceAtMost(maxH.toFloat()),
        )
    }

    companion object {
        private const val ASSET_NAME = "age_net.tflite"

        fun tryCreate(context: Context, inputSize: Int = 224): AgeEstimator? {
            val model = runCatching { FileUtil.loadMappedFile(context, ASSET_NAME) }.getOrNull() ?: return null

            val options = Interpreter.Options().apply {
                numThreads = 4
                val compat = CompatibilityList()
                when {
                    compat.isDelegateSupportedOnThisDevice -> addDelegate(GpuDelegate(compat.bestOptionsForThisDevice))
                    else -> addDelegate(NnApiDelegate())
                }
            }

            val interp = Interpreter(model, options)
            val outShape = interp.getOutputTensor(0).shape() // 例: [1] or [1, 101]
            val numBuckets = if (outShape.size == 2 && outShape[1] > 1) outShape[1] else null
            return AgeEstimator(interp, inputSize, numBuckets)
        }
    }
}

/** ImageProxy (YUV_420_888) → ARGB Bitmap (回転反映済み) */
private fun ImageProxy.toBitmap(): Bitmap? {
    val nv21 = yuv420ToNv21(this) ?: return null
    val out = ByteArrayOutputStream()
    YuvImage(nv21, ImageFormat.NV21, width, height, null)
        .compressToJpeg(Rect(0, 0, width, height), 90, out)
    val bytes = out.toByteArray()
    val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val rot = imageInfo.rotationDegrees
    if (rot == 0) return bmp
    val matrix = Matrix().apply { postRotate(rot.toFloat()) }
    return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
}

private fun yuv420ToNv21(image: ImageProxy): ByteArray? {
    val planes = image.planes
    if (planes.size < 3) return null
    val ySize = planes[0].buffer.remaining()
    val uSize = planes[1].buffer.remaining()
    val vSize = planes[2].buffer.remaining()
    val nv21 = ByteArray(ySize + uSize + vSize)
    planes[0].buffer.get(nv21, 0, ySize)
    planes[2].buffer.get(nv21, ySize, vSize)
    planes[1].buffer.get(nv21, ySize + vSize, uSize)
    return nv21
}
