import Vision
import CoreVideo
import CoreImage
import UIKit

struct FaceDetection {
    /// Bounding box in normalized image coordinates (Vision: origin bottom-left).
    let boundingBoxNormalized: CGRect
    /// Roll/yaw/pitch in radians, when available.
    let roll: CGFloat
    let yaw: CGFloat
    let pitch: CGFloat
    /// Cropped, upright RGB face image suitable for CoreML inference.
    let alignedFace: CGImage
}

final class FaceDetector {
    private let sequenceHandler = VNSequenceRequestHandler()
    private let context = CIContext(options: [.useSoftwareRenderer: false])

    func detect(in pixelBuffer: CVPixelBuffer) -> FaceDetection? {
        let request = VNDetectFaceRectanglesRequest()
        request.revision = VNDetectFaceRectanglesRequestRevision3
        do {
            try sequenceHandler.perform([request], on: pixelBuffer, orientation: .leftMirrored)
        } catch {
            return nil
        }
        guard let observation = (request.results ?? [])
            .max(by: { $0.boundingBox.size.area < $1.boundingBox.size.area }) else {
            return nil
        }

        let bbox = observation.boundingBox
        let width = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
        let height = CGFloat(CVPixelBufferGetHeight(pixelBuffer))

        // Vision normalized bbox -> CIImage pixel rect (origin bottom-left of original buffer).
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
        guard !clipped.isEmpty else { return nil }
        let cropped = ci.cropped(to: clipped)
        guard let cg = context.createCGImage(cropped, from: clipped) else { return nil }

        return FaceDetection(
            boundingBoxNormalized: bbox,
            roll: CGFloat(observation.roll?.doubleValue ?? 0),
            yaw: CGFloat(observation.yaw?.doubleValue ?? 0),
            pitch: CGFloat(observation.pitch?.doubleValue ?? 0),
            alignedFace: cg
        )
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
