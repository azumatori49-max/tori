import Vision
import CoreVideo
import CoreGraphics

struct DetectedFace {
    let boundingBox: CGRect
    let captureQuality: Float
    let yaw: Float
    let pitch: Float
    let roll: Float
}

final class FaceDetector {
    func detect(in pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) throws -> [DetectedFace] {
        let request = VNDetectFaceCaptureQualityRequest()
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])
        try handler.perform([request])

        guard let observations = request.results else { return [] }

        return observations.map { obs in
            DetectedFace(
                boundingBox: obs.boundingBox,
                captureQuality: obs.faceCaptureQuality ?? 0,
                yaw: obs.yaw?.floatValue ?? 0,
                pitch: obs.pitch?.floatValue ?? 0,
                roll: obs.roll?.floatValue ?? 0
            )
        }
    }
}
