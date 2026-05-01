import QuartzCore
import Foundation

/// Lightweight passive liveness check that defeats the most common attack
/// against an unattended kiosk: holding up a printed photo or a phone
/// screen of an adult to bypass the age gate.
///
/// We rely on the fact that a real face presented to the camera shows
/// micro-movements over a couple of seconds (head sway, blinking-induced
/// landmark shifts), while a static photograph held in front of the lens
/// produces near-zero variance in Vision's pose estimates.
///
/// This is *not* a substitute for a proper PAD (Presentation Attack
/// Detection) model. It only stops the lazy attack vector. For higher
/// assurance, swap this out for an iPhone TrueDepth depth-map check on
/// `LiDAR`-equipped devices, or a dedicated CoreML PAD model.
final class LivenessDetector {
    private struct Sample {
        let yaw: Double
        let pitch: Double
        let roll: Double
        let t: CFTimeInterval
    }

    private var samples: [Sample] = []
    private let window: CFTimeInterval
    private let minSamples: Int
    private let minPoseVariance: Double

    init(window: CFTimeInterval = 2.0,
         minSamples: Int = 12,
         minPoseVariance: Double = 0.0008) {
        self.window = window
        self.minSamples = minSamples
        self.minPoseVariance = minPoseVariance
    }

    func observe(yaw: CGFloat, pitch: CGFloat, roll: CGFloat) {
        let now = CACurrentMediaTime()
        samples.append(Sample(yaw: Double(yaw),
                              pitch: Double(pitch),
                              roll: Double(roll),
                              t: now))
        let cutoff = now - window
        samples.removeAll { $0.t < cutoff }
    }

    /// True once we've collected enough samples *and* observed pose variance
    /// consistent with a moving real face.
    var isLive: Bool {
        guard samples.count >= minSamples else { return false }
        let yawVar = variance(samples.map(\.yaw))
        let pitchVar = variance(samples.map(\.pitch))
        let rollVar = variance(samples.map(\.roll))
        return max(yawVar, pitchVar, rollVar) >= minPoseVariance
    }

    func reset() {
        samples.removeAll()
    }

    private func variance(_ xs: [Double]) -> Double {
        guard xs.count >= 2 else { return 0 }
        let mean = xs.reduce(0, +) / Double(xs.count)
        let ss = xs.map { ($0 - mean) * ($0 - mean) }.reduce(0, +)
        return ss / Double(xs.count - 1)
    }
}
