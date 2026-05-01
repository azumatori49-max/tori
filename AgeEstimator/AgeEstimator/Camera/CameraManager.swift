import AVFoundation
import CoreImage

protocol CameraManagerDelegate: AnyObject {
    func cameraManager(_ manager: CameraManager, didOutput pixelBuffer: CVPixelBuffer)
}

final class CameraManager: NSObject {
    let session = AVCaptureSession()
    weak var delegate: CameraManagerDelegate?

    private let videoQueue = DispatchQueue(label: "camera.video.queue", qos: .userInitiated)
    private let videoOutput = AVCaptureVideoDataOutput()
    private var configured = false

    func requestAuthorization() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return true
        case .notDetermined:
            return await AVCaptureDevice.requestAccess(for: .video)
        default: return false
        }
    }

    func configure() throws {
        guard !configured else { return }
        session.beginConfiguration()
        session.sessionPreset = .high

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                   for: .video,
                                                   position: .front) else {
            throw NSError(domain: "Camera", code: -1)
        }
        let input = try AVCaptureDeviceInput(device: device)
        if session.canAddInput(input) { session.addInput(input) }

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        if let conn = videoOutput.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .portrait }
            if conn.isVideoMirroringSupported { conn.isVideoMirrored = true }
        }
        session.commitConfiguration()
        configured = true
    }

    func start() {
        videoQueue.async { [weak self] in
            guard let self, !self.session.isRunning else { return }
            self.session.startRunning()
        }
    }

    func stop() {
        videoQueue.async { [weak self] in
            guard let self, self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        delegate?.cameraManager(self, didOutput: pb)
    }
}
