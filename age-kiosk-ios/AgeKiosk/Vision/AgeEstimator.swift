import CoreML
import Vision
import CoreVideo
import CoreImage
import UIKit

enum AgeEstimatorError: Error {
    case modelMissing
    case inferenceFailed
    case cropFailed
}

/// Wraps a Core ML age regression / age-bucket classification model.
///
/// Expected model:
///  - Input: 224x224 (or 227x227) RGB image, named `image`.
///  - Output: either
///     * `MLFeatureProvider` with `age` (Double / Float) for a regression model, or
///     * `classLabelProbs` keyed by age-bucket string (e.g. `"25-32"`) for a classification model.
///
/// Drop a Core ML model file named `AgeNet.mlmodelc` into the app bundle.
/// See `tools/convert_age_model.py` for a conversion recipe.
final class AgeEstimator {
    private let model: MLModel?
    private let inputSize: CGSize
    private let inputName: String
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    init(modelName: String = "AgeNet", inputSize: CGSize = CGSize(width: 224, height: 224), inputName: String = "image") {
        self.inputSize = inputSize
        self.inputName = inputName

        if let url = Bundle.main.url(forResource: modelName, withExtension: "mlmodelc"),
           let compiled = try? MLModel(contentsOf: url, configuration: Self.makeConfig()) {
            self.model = compiled
        } else if let url = Bundle.main.url(forResource: modelName, withExtension: "mlmodel"),
                  let compiledURL = try? MLModel.compileModel(at: url),
                  let compiled = try? MLModel(contentsOf: compiledURL, configuration: Self.makeConfig()) {
            self.model = compiled
        } else {
            self.model = nil
        }
    }

    var isAvailable: Bool { model != nil }

    func estimate(pixelBuffer: CVPixelBuffer, faceBox: CGRect, orientation: CGImagePropertyOrientation) throws -> Float {
        guard let model else { throw AgeEstimatorError.modelMissing }
        guard let cropped = cropFace(pixelBuffer: pixelBuffer, normalizedBox: faceBox, orientation: orientation) else {
            throw AgeEstimatorError.cropFailed
        }

        let featureValue = MLFeatureValue(pixelBuffer: cropped)
        let provider = try MLDictionaryFeatureProvider(dictionary: [inputName: featureValue])
        let prediction = try model.prediction(from: provider)

        if let regression = prediction.featureValue(for: "age")?.doubleValue {
            return Float(regression)
        }

        if let probs = prediction.featureValue(for: "classLabelProbs")?.dictionaryValue as? [String: NSNumber] {
            return Self.weightedAge(from: probs)
        }

        if let label = prediction.featureValue(for: "classLabel")?.stringValue,
           let age = Self.midpoint(forBucket: label) {
            return Float(age)
        }

        throw AgeEstimatorError.inferenceFailed
    }

    // MARK: - Helpers

    private static func makeConfig() -> MLModelConfiguration {
        let config = MLModelConfiguration()
        config.computeUnits = .all
        return config
    }

    /// Convert age-bucket probabilities (`"0-2"`, `"4-6"`, ..., `"60-"`) into an
    /// expected-value year using probability-weighted bucket midpoints.
    private static func weightedAge(from probs: [String: NSNumber]) -> Float {
        var num: Double = 0
        var den: Double = 0
        for (label, p) in probs {
            guard let mid = midpoint(forBucket: label) else { continue }
            let pv = p.doubleValue
            num += mid * pv
            den += pv
        }
        return den > 0 ? Float(num / den) : 0
    }

    private static func midpoint(forBucket label: String) -> Double? {
        let trimmed = label.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "+", with: "")
        let parts = trimmed.split(separator: "-").map { String($0) }
        if parts.count == 2,
           let lo = Double(parts[0]),
           let hi = Double(parts[1]) {
            return (lo + hi) / 2.0
        }
        if parts.count == 1, let lo = Double(parts[0]) {
            return lo + 5
        }
        return nil
    }

    /// Crop the face from the source pixel buffer with a small margin and resize
    /// to the model input size, returning a new BGRA pixel buffer.
    private func cropFace(pixelBuffer: CVPixelBuffer, normalizedBox: CGRect, orientation: CGImagePropertyOrientation) -> CVPixelBuffer? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer).oriented(orientation)
        let w = ciImage.extent.width
        let h = ciImage.extent.height

        // Vision's normalized rect uses bottom-left origin in image coordinates after orientation.
        let rect = VNImageRectForNormalizedRect(normalizedBox, Int(w), Int(h))
        let margin: CGFloat = 0.25
        let expanded = rect.insetBy(dx: -rect.width * margin, dy: -rect.height * margin)
        let clamped = expanded.intersection(ciImage.extent)
        guard !clamped.isNull, clamped.width > 1, clamped.height > 1 else { return nil }

        let cropped = ciImage.cropped(to: clamped)
        let sx = inputSize.width / clamped.width
        let sy = inputSize.height / clamped.height
        let scaled = cropped
            .transformed(by: CGAffineTransform(translationX: -clamped.minX, y: -clamped.minY))
            .transformed(by: CGAffineTransform(scaleX: sx, y: sy))

        var output: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ]
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            Int(inputSize.width),
            Int(inputSize.height),
            kCVPixelFormatType_32BGRA,
            attrs as CFDictionary,
            &output
        )
        guard let buffer = output else { return nil }
        ciContext.render(scaled, to: buffer)
        return buffer
    }
}
