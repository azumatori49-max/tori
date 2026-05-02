import SwiftUI
import AVFoundation
import CoreVideo
import QuartzCore

/// State of the kiosk during a single screening attempt.
enum AgeEstimationState: Equatable {
    /// No usable face yet — show the prompt to step into the frame.
    case searching
    /// More than one face in front of the camera.
    case multipleFaces
    /// Face is in frame but not yet aligned.
    case aligning(progress: Double)
    /// Aligned, asking the user to move slightly so we can confirm liveness.
    case livenessRequired
    /// Running CoreML inference.
    case estimating
    /// Decision reached.
    case cleared(age: Double, confidence: Double)
    case idCheckRequired(age: Double, confidence: Double)
    case blockedMinor

    var isTerminal: Bool {
        switch self {
        case .cleared, .idCheckRequired, .blockedMinor: return true
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
    private let liveness = LivenessDetector()
    private let policy: ScreeningPolicy = .izakaya

    private let requiredAlignedFrames = 12
    private let inferencesForResult = 5
    private let inferenceMinInterval: CFTimeInterval = 0.20
    /// How long a terminal screen stays before the kiosk auto-resets for the
    /// next customer.
    private let kioskResetSeconds: TimeInterval = 8

    private var alignedFrameCount = 0
    private var inferencesCollected = 0
    private var inferenceInFlight = false
    private var lastInferenceAt: CFTimeInterval = 0
    private var resetWorkItem: DispatchWorkItem?

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
        resetWorkItem?.cancel()
    }

    func reset() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.smoother.reset()
            self.liveness.reset()
            self.alignedFrameCount = 0
            self.inferencesCollected = 0
            self.inferenceInFlight = false
            self.resetWorkItem?.cancel()
            self.state = .searching
        }
    }

    #if DEBUG
    /// Force the view model into a given state. Used by `SimulatorHarness`
    /// for design-review on the iOS Simulator where there is no camera feed.
    func simulate(state: AgeEstimationState) {
        DispatchQueue.main.async { [weak self] in
            self?.resetWorkItem?.cancel()
            self?.state = state
            if state.isTerminal {
                self?.scheduleAutoReset()
            }
        }
    }
    #endif

    private func scheduleAutoReset() {
        resetWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.reset() }
        resetWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + kioskResetSeconds, execute: work)
    }
}

extension AgeEstimationViewModel: CameraManagerDelegate {
    func cameraManager(_ manager: CameraManager, didOutput pixelBuffer: CVPixelBuffer) {
        let result = faceDetector.detect(in: pixelBuffer)

        DispatchQueue.main.async { [weak self] in
            guard let self, !self.state.isTerminal else { return }

            if result.totalFaceCount > 1 {
                self.alignedFrameCount = 0
                self.liveness.reset()
                self.state = .multipleFaces
                return
            }

            guard let detection = result.primary else {
                self.alignedFrameCount = 0
                self.liveness.reset()
                self.state = .searching
                return
            }

            self.handle(detection)
        }
    }

    private func handle(_ detection: FaceDetection) {
        // Always feed the liveness detector while we have a face in view.
        liveness.observe(yaw: detection.yaw,
                         pitch: detection.pitch,
                         roll: detection.roll)

        let aligned = FrameAlignment.isAligned(detection)
        let alignmentScore = FrameAlignment.score(for: detection)

        if !aligned {
            alignedFrameCount = max(0, alignedFrameCount - 1)
            state = .aligning(progress: Double(alignmentScore))
            return
        }

        alignedFrameCount += 1
        let progress = min(1.0, Double(alignedFrameCount) / Double(requiredAlignedFrames))
        if alignedFrameCount < requiredAlignedFrames {
            state = .aligning(progress: progress)
            return
        }

        // Aligned — but block estimation until we've also confirmed liveness.
        guard liveness.isLive else {
            state = .livenessRequired
            return
        }

        if case .estimating = state {} else {
            state = .estimating
        }

        let now = CACurrentMediaTime()
        guard !inferenceInFlight,
              now - lastInferenceAt >= inferenceMinInterval else { return }
        inferenceInFlight = true
        lastInferenceAt = now
        runInference(on: detection.alignedFace)
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
                DispatchQueue.main.async { [weak self] in
                    self?.consume(prediction: smoothed, stdDev: stdDev)
                }
            }
        }
    }

    private func consume(prediction: AgePrediction, stdDev: Double) {
        inferenceInFlight = false
        inferencesCollected += 1
        guard inferencesCollected >= inferencesForResult else { return }

        let outcome = policy.evaluate(age: prediction.age,
                                      stdDev: stdDev,
                                      sampleCount: inferencesCollected)
        switch outcome {
        case .cleared:
            state = .cleared(age: prediction.age, confidence: prediction.confidence)
        case .idCheckRequired:
            state = .idCheckRequired(age: prediction.age, confidence: prediction.confidence)
        case .blockedMinor:
            state = .blockedMinor
        }
        scheduleAutoReset()
    }
}
