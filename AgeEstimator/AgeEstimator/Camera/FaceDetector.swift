import Vision
import CoreVideo
import CoreImage
import CoreGraphics

final class FaceDetector {
    private let sequenceHandler = VNSequenceRequestHandler()
    private let context = CIContext(options: [.useSoftwareRenderer: false])
    /// Faces below this normalized bbox height are assumed to be background
    /// passers-by, not the customer in front of the kiosk.
    private let foregroundMinHeight: CGFloat = 0.18

    func detect(in pixelBuffer: CVPixelBuffer) -> FaceDetectionResult {
        let request = VNDetectFaceRectanglesRequest()
        request.revision = VNDetectFaceRectanglesRequestRevision3
        do {
            try sequenceHandler.perform([request], on: pixelBuffer, orientation: .leftMirrored)
        } catch {
            return FaceDetectionResult(totalFaceCount: 0, primary: nil)
        }

        let observations = (request.results ?? [])
            .filter { $0.boundingBox.height >= foregroundMinHeight }

        guard let largest = observations
            .max(by: { $0.boundingBox.size.area < $1.boundingBox.size.area }) else {
            return FaceDetectionResult(totalFaceCount: 0, primary: nil)
        }

        let bbox = largest.boundingBox
        let width = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
        let height = CGFloat(CVPixelBufferGetHeight(pixelBuffer))

        let pixelRect = CGRect(
            x: bbox.origin.x * width,
            y: bbox.origin.y * height,
            width: bbox.width * width,
            height: bbox.height * height
        ).expanded(by: 0.25).integral

        let ci = CIImage(cvPixelBuffer: pixelBuffer)
            .oriented(.leftMirrored)
        let imgRect = ci.extent
        let clipped = pixelRect.intersection(imgRect)
        guard !clipped.isEmpty,
              let cg = context.createCGImage(ci.cropped(to: clipped), from: clipped) else {
            return FaceDetectionResult(totalFaceCount: observations.count, primary: nil)
        }

        let primary = FaceDetection(
            boundingBoxNormalized: bbox,
            roll: CGFloat(largest.roll?.doubleValue ?? 0),
            yaw: CGFloat(largest.yaw?.doubleValue ?? 0),
            pitch: CGFloat(largest.pitch?.doubleValue ?? 0),
            alignedFace: cg
        )
        return FaceDetectionResult(totalFaceCount: observations.count, primary: primary)
    }
}

private extension CGRect {
    func expanded(by ratio: CGFloat) -> CGRect {
        let dx = width * ratio
        let dy = height * ratio
        return insetBy(dx: -dx / 2, dy: -dy / 2)
    }
}

private extension CGSize {
    var area: CGFloat { width * height }
}
