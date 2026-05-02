import Foundation

/// One smoothed/raw prediction emitted by `AgeEstimator`.
struct AgePrediction: Equatable {
    /// Raw model output before Japanese calibration.
    let rawAge: Double
    /// Final calibrated age (years).
    let age: Double
    /// 0...1 confidence derived from the model's class probability mass.
    let confidence: Double
}
