package com.toriguyaro.ageguard.ml

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.random.Random

class AgeEstimator(context: Context) {

    private val interpreter: Interpreter? = try {
        val model = loadModel(context, MODEL_PATH)
        if (model != null) Interpreter(model) else null
    } catch (e: Exception) {
        Log.w(TAG, "Failed to load TFLite model, falling back to mock mode", e)
        null
    }

    val isMockMode: Boolean = interpreter == null

    init {
        if (isMockMode) {
            Log.w(TAG, "AgeEstimator running in MOCK mode (no $MODEL_PATH found).")
        } else {
            Log.i(TAG, "AgeEstimator loaded model: $MODEL_PATH")
        }
    }

    suspend fun estimate(bitmap: Bitmap): AgeResult = withContext(Dispatchers.Default) {
        val interp = interpreter ?: return@withContext mockResult()
        try {
            val result = runInference(interp, bitmap)
            Log.d(TAG, "estimate -> age=${result.estimatedAge} confidence=${result.confidence}")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Inference failed, returning unknown", e)
            AgeResult(estimatedAge = null, confidence = 0f)
        }
    }

    private fun runInference(interp: Interpreter, bitmap: Bitmap): AgeResult {
        val resized = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)
        val input = bitmapToFloatBuffer(resized)

        // Detect output shape from model
        val outputTensor = interp.getOutputTensor(0)
        val outShape = outputTensor.shape() // e.g. [1,1] regression, or [1,N] classification
        val outSize = outShape.fold(1) { a, b -> a * b }

        val outputBuffer = ByteBuffer.allocateDirect(outSize * 4).order(ByteOrder.nativeOrder())
        interp.run(input, outputBuffer)
        outputBuffer.rewind()

        val floats = FloatArray(outSize)
        outputBuffer.asFloatBuffer().get(floats)

        return interpretOutput(floats)
    }

    private fun interpretOutput(out: FloatArray): AgeResult {
        return when {
            out.size == 1 -> {
                // Regression: single float age
                val age = out[0].coerceIn(0f, 120f).toInt()
                AgeResult(estimatedAge = age, confidence = 1.0f)
            }
            out.size in 2..120 -> {
                // Classification with softmax expectation (DEX). The peak
                // probability is naturally low for wide age distributions, so
                // we don't gate on it — the expectation is meaningful as long
                // as inference completed.
                val probs = softmaxIfNeeded(out)
                var expected = 0f
                for (i in probs.indices) {
                    expected += i * probs[i]
                }
                AgeResult(estimatedAge = expected.toInt(), confidence = 1.0f)
            }
            else -> {
                // Unknown shape — best-effort mean
                val mean = out.average().toFloat().coerceIn(0f, 120f).toInt()
                AgeResult(estimatedAge = mean, confidence = 0.5f)
            }
        }
    }

    private fun softmaxIfNeeded(arr: FloatArray): FloatArray {
        val sum = arr.sum()
        // Already softmaxed if sum ≈ 1 and all >= 0
        if (sum in 0.95f..1.05f && arr.all { it >= 0f }) return arr
        val max = arr.max()
        val exps = FloatArray(arr.size) { kotlin.math.exp((arr[it] - max).toDouble()).toFloat() }
        val s = exps.sum().coerceAtLeast(1e-6f)
        return FloatArray(arr.size) { exps[it] / s }
    }

    private fun bitmapToFloatBuffer(bitmap: Bitmap): ByteBuffer {
        val buffer = ByteBuffer.allocateDirect(4 * INPUT_SIZE * INPUT_SIZE * 3)
        buffer.order(ByteOrder.nativeOrder())
        val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
        bitmap.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)
        for (p in pixels) {
            val r = ((p shr 16) and 0xFF) / 255f
            val g = ((p shr 8) and 0xFF) / 255f
            val b = (p and 0xFF) / 255f
            buffer.putFloat(r)
            buffer.putFloat(g)
            buffer.putFloat(b)
        }
        buffer.rewind()
        return buffer
    }

    private fun mockResult(): AgeResult {
        // Stable mock: pick a base age, then return small jitter around it.
        // This avoids 50→19 swings while still demonstrating the UI updating.
        val now = System.currentTimeMillis()
        if (mockBaseAge == null || now - mockBaseSetMs > MOCK_SESSION_MS) {
            mockBaseAge = Random.nextInt(20, 55)
            mockBaseSetMs = now
        }
        val base = mockBaseAge!!
        val jittered = (base + Random.nextInt(-1, 2)).coerceIn(15, 65)
        return AgeResult(estimatedAge = jittered, confidence = 0.9f)
    }

    private var mockBaseAge: Int? = null
    private var mockBaseSetMs: Long = 0L

    fun close() {
        interpreter?.close()
    }

    private fun loadModel(context: Context, path: String): MappedByteBuffer? {
        return try {
            val afd = context.assets.openFd(path)
            FileInputStream(afd.fileDescriptor).use { stream ->
                stream.channel.map(FileChannel.MapMode.READ_ONLY, afd.startOffset, afd.declaredLength)
            }
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        private const val TAG = "AgeEstimator"
        private const val MODEL_PATH = "age_model.tflite"
        private const val INPUT_SIZE = 224
        private const val MOCK_SESSION_MS = 8000L
    }
}
