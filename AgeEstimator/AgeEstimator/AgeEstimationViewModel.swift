import SwiftUI
import AVFoundation
import CoreVideo

enum AgeEstimationState: Equatable {
    case searching
    case aligning(progress: Double)
    case estimating
    case result(age: Double, confidence: Double)
    /// Predicted age was below the minor gate's threshold with enough
    /// confidence that we refuse to display a number.
    case blockedMinor

    var isTerminal: Bool {
        switch self {
        case .result, .blockedMinor: return true
        default: return false
        }
    }
}

final class AgeEstimationViewModel: ObservableObject {
    @Published private(set) var state: AgeEstimationState = .searching

    let cameraManager = CameraManager()
    private let faceDetector = FaceDetector()
    private let estimator = AgeEstimator()
    private let smoother = PredictionSmoother(capacity: 5)
    private let minorGuard: MinorGuard = .default

    /// Number of consecutive aligned frames required before triggering inference.
    private let requiredAlignedFrames = 12
    /// How many CoreML inferences to average for the final age.
    private let inferencesForResult = 5
    /// Throttle: at most one inference per N seconds while estimating.
    private let inferenceMinInterval: CFTimeInterval = 0.20

    private var alignedFrameCount = 0
    private var inferencesCollected = 0
    private var inferenceInFlight = false
    private var lastInferenceAt: CFTimeInterval = 0

    init() {
        cameraManager.delegate = self
    }

    func start() async {
        guard await cameraManager.requestAuthorization() else { return }
        do {
            try cameraManager.configure()
            cameraManager.start()
        } catch {
            #if DEBUG
            print("Camera configure failed: \(error)")
            #endif
        }
    }

    func stop() {
        cameraManager.stop()
    }

    func reset() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.smoother.reset()
            self.alignedFrameCount = 0
            self.inferencesCollected = 0
            self.state = .searching
        }
    }

    private func updateState(_ newValue: AgeEstimationState) {
        if Thread.isMainThread {
            state = newValue
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.state = newValue
            }
        }
    }
}

extension AgeEstimationViewModel: CameraManagerDelegate {
    func cameraManager(_ manager: CameraManager, didOutput pixelBuffer: CVPixelBuffer) {
        // Runs on the camera dispatch queue.
        guard let detection = faceDetector.detect(in: pixelBuffer) else {
            handleNoFace()
            return
        }
        handleDetection(detection)
    }

    private func handleNoFace() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.state.isTerminal { return }
            self.alignedFrameCount = 0
            self.state = .searching
        }
    }

    private func handleDetection(_ detection: FaceDetection) {
        let aligned = FrameAlignment.isAligned(detection)
        let alignmentScore = FrameAlignment.score(for: detection)

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.state.isTerminal { return }

            if !aligned {
                self.alignedFrameCount = max(0, self.alignedFrameCount - 1)
                self.state = .aligning(progress: Double(alignmentScore))
                return
            }

            self.alignedFrameCount += 1
            let progress = min(1.0, Double(self.alignedFrameCount) / Double(self.requiredAlignedFrames))
            if self.alignedFrameCount < self.requiredAlignedFrames {
                self.state = .aligning(progress: progress)
                return
            }

            if case .estimating = self.state {} else {
                self.state = .estimating
            }

            let now = CACurrentMediaTime()
            guard !self.inferenceInFlight,
                  now - self.lastInferenceAt >= self.inferenceMinInterval else { return }
            self.inferenceInFlight = true
            self.lastInferenceAt = now
            self.runInference(on: detection.alignedFace)
        }
    }

    private static let inferenceQueue = DispatchQueue(label: "age.inference",
                                                      qos: .userInitiated)

    private func runInference(on face: CGImage) {
        Self.inferenceQueue.async { [estimator, smoother, weak self] in
            estimator.predict(face: face) { prediction in
                guard let prediction else {
                    DispatchQueue.main.async { self?.inferenceInFlight = false }
                    return
                }
                let smoothed = smoother.add(prediction)
                let stdDev = smoother.ageStdDev
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.inferenceInFlight = false
                    self.inferencesCollected += 1
                    guard self.inferencesCollected >= self.inferencesForResult else {
                        return
                    }
                    if self.minorGuard.shouldBlock(age: smoothed.age,
                                                   stdDev: stdDev,
                                                   sampleCount: self.inferencesCollected) {
                        self.state = .blockedMinor
                    } else {
                        self.state = .result(age: smoothed.age,
                                             confidence: smoothed.confidence)
                    }
                }
            }
        }
    }
}
