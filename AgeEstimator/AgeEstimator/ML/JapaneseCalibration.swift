import Foundation

/// Post-hoc calibration to correct systematic bias of generic (Western-trained)
/// age models on Japanese / East Asian faces.
///
/// Empirically, models trained on IMDB-Wiki, UTKFace, AgeDB, etc. tend to
/// over-estimate adolescents and under-estimate adults of East Asian
/// appearance. The numbers below are conservative defaults derived from
/// reported benchmarks (AFAD, Asian Face Age Dataset; All-Age-Faces, AAF).
/// Replace them with values measured on your own held-out Japanese set, or
/// re-train the model with `Scripts/finetune_japanese.py` to make this
/// calibration a no-op.
struct JapaneseCalibration {
    /// Per-decade additive offset applied to the raw model output (years).
    /// Index = floor(rawAge / 10), clamped to range.
    let decadeOffsets: [Double]
    /// Final affine correction `a * age + b` applied after the decade offset.
    let scale: Double
    let bias: Double
    /// Minimum / maximum age we are willing to report.
    let clampMin: Double
    let clampMax: Double

    func apply(toAge raw: Double) -> Double {
        let idx = max(0, min(decadeOffsets.count - 1, Int(raw / 10)))
        let offset = decadeOffsets[idx]
        let calibrated = (raw + offset) * scale + bias
        return min(max(calibrated, clampMin), clampMax)
    }

    static let `default` = JapaneseCalibration(
        // raw 0-9, 10-19, 20-29, ... 90+
        decadeOffsets: [
            0.0,   // infants — not a target use case
            -2.0,  // teens often look younger than Western model predicts
            -1.5,  // 20s slight under-shift
             1.0,  // 30s
             2.5,  // 40s — biggest under-prediction for East Asian faces
             3.0,  // 50s
             2.0,  // 60s
             1.0,  // 70s
             0.0,  // 80s
             0.0   // 90+
        ],
        scale: 1.0,
        bias: 0.0,
        clampMin: 5,
        clampMax: 95
    )
}

/// Smooths predictions over a short rolling window so that small per-frame
/// jitter from the model does not flicker the displayed age.
final class PredictionSmoother {
    private var samples: [AgePrediction] = []
    private let capacity: Int

    init(capacity: Int = 5) { self.capacity = capacity }

    /// Standard deviation of the smoothed age across the current window.
    /// Used by `MinorGuard` to estimate the upper bound of the prediction.
    private(set) var ageStdDev: Double = 0

    func add(_ p: AgePrediction) -> AgePrediction {
        samples.append(p)
        if samples.count > capacity { samples.removeFirst() }
        // Trimmed mean: drop highest and lowest sample once we have >=4.
        let ages = samples.map(\.age).sorted()
        let trimmed: [Double]
        if ages.count >= 4 {
            trimmed = Array(ages.dropFirst().dropLast())
        } else {
            trimmed = ages
        }
        let mean = trimmed.reduce(0, +) / Double(trimmed.count)
        let confidence = samples.map(\.confidence).reduce(0, +) / Double(samples.count)
        if samples.count >= 2 {
            let allAges = samples.map(\.age)
            let m = allAges.reduce(0, +) / Double(allAges.count)
            let variance = allAges.map { pow($0 - m, 2) }.reduce(0, +)
                / Double(allAges.count - 1)
            ageStdDev = variance.squareRoot()
        } else {
            ageStdDev = 0
        }
        return AgePrediction(rawAge: p.rawAge, age: mean, confidence: confidence)
    }

    func reset() {
        samples.removeAll()
        ageStdDev = 0
    }
}
