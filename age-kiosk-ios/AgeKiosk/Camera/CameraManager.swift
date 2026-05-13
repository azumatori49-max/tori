import AVFoundation
import CoreImage
import UIKit

protocol CameraManagerDelegate: AnyObject {
    func cameraManager(_ manager: CameraManager, didOutput pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation)
}

final class CameraManager: NSObject {
    weak var delegate: CameraManagerDelegate?

    let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "agekiosk.camera.session")
    private let videoQueue = DispatchQueue(label: "agekiosk.camera.video")
    private let videoOutput = AVCaptureVideoDataOutput()

    private(set) var isRunning = false

    func configure() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            self.session.sessionPreset = .hd1280x720

            guard
                let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
                let input = try? AVCaptureDeviceInput(device: device),
                self.session.canAddInput(input)
            else {
                self.session.commitConfiguration()
                return
            }
            self.session.addInput(input)
            Self.configureForDimEnvironment(device)

            self.videoOutput.videoSettings = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ]
            self.videoOutput.alwaysDiscardsLateVideoFrames = true
            self.videoOutput.setSampleBufferDelegate(self, queue: self.videoQueue)

            if self.session.canAddOutput(self.videoOutput) {
                self.session.addOutput(self.videoOutput)
            }

            if let connection = self.videoOutput.connection(with: .video) {
                if connection.isVideoOrientationSupported {
                    connection.videoOrientation = .portrait
                }
                if connection.isVideoMirroringSupported {
                    connection.isVideoMirrored = true
                }
            }

            self.session.commitConfiguration()
        }
    }

    func start() {
        sessionQueue.async { [weak self] in
            guard let self, !self.session.isRunning else { return }
            self.session.startRunning()
            self.isRunning = self.session.isRunning
        }
    }

    func stop() {
        sessionQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
            self.isRunning = false
        }
    }

    /// 居酒屋入口は薄暗いことが多いので、低照度向けの設定を有効化する。
    /// - 連続オートフォーカス / 露出 / WB
    /// - 低照度ブースト (対応端末)
    /// - 最低フレームレートを 24fps に落としてシャッターを長くする
    private static func configureForDimEnvironment(_ device: AVCaptureDevice) {
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }

            if device.isFocusModeSupported(.continuousAutoFocus) {
                device.focusMode = .continuousAutoFocus
            }
            if device.isExposureModeSupported(.continuousAutoExposure) {
                device.exposureMode = .continuousAutoExposure
            }
            if device.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) {
                device.whiteBalanceMode = .continuousAutoWhiteBalance
            }
            if device.isLowLightBoostSupported {
                device.automaticallyEnablesLowLightBoostWhenAvailable = true
            }
            // 顔の側を優先して露出 / フォーカス
            if device.isAutoFocusRangeRestrictionSupported {
                device.autoFocusRangeRestriction = .near
            }
            // 24-30fps レンジに固定 (低照度時にシャッタを長く取らせる)
            let target = CMTime(value: 1, timescale: 24)
            if device.activeFormat.videoSupportedFrameRateRanges
                .contains(where: { $0.minFrameRate <= 24 && $0.maxFrameRate >= 24 }) {
                device.activeVideoMinFrameDuration = target
                device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 30)
            }
        } catch {
            // 設定に失敗しても致命的ではないので無視。
        }
    }

    static func requestAuthorization() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return true
        case .notDetermined:
            return await AVCaptureDevice.requestAccess(for: .video)
        default:
            return false
        }
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        delegate?.cameraManager(self, didOutput: pixelBuffer, orientation: .leftMirrored)
    }
}
