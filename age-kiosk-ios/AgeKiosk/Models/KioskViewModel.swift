import Foundation
import AVFoundation
import CoreVideo
import Combine
import UIKit

@MainActor
final class KioskViewModel: ObservableObject {
    enum State: Equatable {
        case waiting                       // 顔がフレームに入っていない
        case scanning(Float)               // スキャン中 (進捗 0...1)
        case result(Int)                   // 推定年齢
        case noPermission
        case noModel
    }

    @Published private(set) var state: State = .waiting
    @Published private(set) var faceBox: CGRect? = nil

    let camera = CameraManager()
    private let detector = FaceDetector()
    private let estimator = AgeEstimator()
    private let smoother = AgeSmoother(alpha: 0.35)

    private var lastInferenceAt: CFTimeInterval = 0
    private let inferenceInterval: CFTimeInterval = 1.0 / 6.0
    private var resultHoldStart: Date?
    private let resultHoldDuration: TimeInterval = 4.0

    init() {
        camera.delegate = self
    }

    func bootstrap() async {
        let ok = await CameraManager.requestAuthorization()
        guard ok else {
            state = .noPermission
            return
        }
        guard estimator.isAvailable else {
            state = .noModel
            return
        }
        camera.configure()
        camera.start()
    }

    func resetToWaiting() {
        smoother.reset()
        resultHoldStart = nil
        state = .waiting
        faceBox = nil
    }
}

extension KioskViewModel: CameraManagerDelegate {
    nonisolated func cameraManager(
        _ manager: CameraManager,
        didOutput pixelBuffer: CVPixelBuffer,
        orientation: CGImagePropertyOrientation
    ) {
        let now = CACurrentMediaTime()
        Task { @MainActor [weak self] in
            guard let self else { return }

            if case .result = self.state,
               let start = self.resultHoldStart,
               Date().timeIntervalSince(start) > self.resultHoldDuration {
                self.resetToWaiting()
            }

            guard now - self.lastInferenceAt >= self.inferenceInterval else { return }
            self.lastInferenceAt = now

            await self.process(pixelBuffer: pixelBuffer, orientation: orientation)
        }
    }

    private func process(pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) async {
        let faces: [DetectedFace]
        do {
            faces = try detector.detect(in: pixelBuffer, orientation: orientation)
        } catch {
            return
        }

        guard let face = faces
            .filter({ $0.boundingBox.width > 0.18 })
            .max(by: { $0.boundingBox.width < $1.boundingBox.width })
        else {
            faceBox = nil
            if case .result = state { return }
            smoother.reset()
            state = .waiting
            return
        }

        faceBox = Self.previewRect(from: face.boundingBox)

        if case .result = state { return }

        do {
            let raw = try estimator.estimate(
                pixelBuffer: pixelBuffer,
                faceBox: face.boundingBox,
                orientation: orientation
            )
            let calibrated = JapaneseCalibrator.calibrate(rawAge: raw)
            let w = JapaneseCalibrator.weight(
                captureQuality: face.captureQuality,
                yaw: face.yaw,
                pitch: face.pitch,
                roll: face.roll
            )
            let smoothed = smoother.update(age: calibrated, weight: w)

            if smoother.isStable {
                let display = Int(smoothed.rounded())
                resultHoldStart = Date()
                state = .result(display)
            } else {
                let progress = min(1.0, Float(smoother.smoothed ?? 0 > 0 ? 0.7 : 0.3))
                state = .scanning(progress)
            }
        } catch {
            return
        }
    }

    private static func previewRect(from visionRect: CGRect) -> CGRect {
        CGRect(
            x: visionRect.minX,
            y: 1 - visionRect.maxY,
            width: visionRect.width,
            height: visionRect.height
        )
    }
}
