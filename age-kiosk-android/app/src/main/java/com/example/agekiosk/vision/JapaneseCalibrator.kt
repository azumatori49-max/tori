package com.example.agekiosk.vision

import kotlin.math.abs

/**
 * 日本人 (East Asian) 向けの年齢キャリブレーション。
 *
 * 公開年齢推定モデル (IMDB-WIKI / Adience / UTKFace 等) は欧米人サンプルが多く、
 * 東アジア人 (特に女性) の年齢を実年齢より若く推定する偏りが報告されている。
 * 区分線形オフセット + 縮約 (平均回帰) + 顔品質に応じた EMA で
 * 表示値を日本人向けに寄せる。
 *
 * 真に日本人特化したい場合は AFAD 等で学習した .tflite に差し替えるのが最良。
 */
object JapaneseCalibrator {
    fun calibrate(rawAge: Float): Float {
        val age = rawAge.coerceIn(0f, 100f)

        val offset = when {
            age < 6  ->  0f
            age < 12 ->  1f
            age < 18 ->  2.5f
            age < 25 ->  4f
            age < 35 ->  4.5f
            age < 45 ->  3.5f
            age < 55 ->  2f
            age < 65 ->  1f
            else     ->  0f
        }

        val prior = 38f
        val shrink = 0.08f
        val shrunk = age + (prior - age) * shrink

        return (shrunk + offset).coerceIn(0f, 100f)
    }

    /** 顔向きから 0..1 の重みを返す (顔がカメラに向いているほど大)。 */
    fun weight(yawDeg: Float, pitchDeg: Float, rollDeg: Float): Float {
        val yawW   = (1f - abs(yawDeg)   / 35f).coerceAtLeast(0f)
        val pitchW = (1f - abs(pitchDeg) / 30f).coerceAtLeast(0f)
        val rollW  = (1f - abs(rollDeg)  / 35f).coerceAtLeast(0f)
        return yawW * pitchW * rollW
    }
}

class AgeSmoother(private val alpha: Float = 0.35f) {
    private var smoothed: Float? = null
    private var totalWeight: Float = 0f

    val isStable: Boolean get() = totalWeight >= 3f
    val value: Float? get() = smoothed

    fun update(age: Float, weight: Float): Float {
        val w = weight.coerceIn(0.05f, 1f)
        val s = smoothed
        return if (s == null) {
            smoothed = age
            totalWeight = w
            age
        } else {
            val a = alpha * w
            val next = s * (1 - a) + age * a
            smoothed = next
            totalWeight += w
            next
        }
    }

    fun reset() {
        smoothed = null
        totalWeight = 0f
    }
}
