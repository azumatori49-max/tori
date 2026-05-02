import CoreML
import Vision
import CoreImage
import CoreGraphics
import Foundation

/// Runs CoreML age regression / classification on a cropped face image and
/// applies the Japanese calibration on top of the raw prediction.
final class AgeEstimator {
    private let model: VNCoreMLModel?
    private let calibration: JapaneseCalibration

    init(calibration: JapaneseCalibration = .default) {
        self.calibration = calibration
        self.model = Self.loadModel()
    }

    func predict(face cgImage: CGImage,
                 completion: @escaping (AgePrediction?) -> Void) {
        rawPredict(face: cgImage) { [calibration] raw in
            guard let raw else { completion(nil); return }
            let calibrated = calibration.apply(toAge: raw.age)
            completion(AgePrediction(rawAge: raw.age,
                                     age: calibrated,
                                     confidence: raw.confidence))
        }
    }

    // MARK: - Private

    private struct RawPrediction {
        let age: Double
        let confidence: Double
    }

    private func rawPredict(face cgImage: CGImage,
                            completion: @escaping (RawPrediction?) -> Void) {
        guard let model else {
            #if DEBUG
            // Fallback so the app is runnable before AgeNetJP.mlmodel is added.
            completion(RawPrediction(age: Double.random(in: 22...44), confidence: 0.5))
            #else
            completion(nil)
            #endif
            return
        }

        let request = VNCoreMLRequest(model: model) { req, _ in
            completion(Self.parse(req.results))
        }
        request.imageCropAndScaleOption = .centerCrop

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
        do {
            try handler.perform([request])
        } catch {
            completion(nil)
        }
    }

    /// Supports two common output shapes for age models:
    ///  1. Classification over per-year buckets (e.g. 0...100). Picks an
    ///     expected value across the softmax distribution.
    ///  2. Regression with a single MLMultiArray scalar.
    private static func parse(_ results: [VNObservation]?) -> RawPrediction? {
        guard let results else { return nil }

        if let classifications = results as? [VNClassificationObservation],
           !classifications.isEmpty {
            var expected = 0.0
            var totalProb = 0.0
            var topProb = 0.0
            for c in classifications {
                guard let bucket = Double(c.identifier) else { continue }
                let p = Double(c.confidence)
                expected += bucket * p
                totalProb += p
                topProb = max(topProb, p)
            }
            guard totalProb > 0 else { return nil }
            return RawPrediction(age: expected / totalProb,
                                 confidence: min(1.0, topProb * 4))
        }

        if let feature = (results.first as? VNCoreMLFeatureValueObservation)?.featureValue {
            if let arr = feature.multiArrayValue {
                if arr.count == 1 {
                    return RawPrediction(age: arr[0].doubleValue, confidence: 0.8)
                }
                // Treat as discrete distribution over [0, count-1] years.
                var expected = 0.0
                var sum = 0.0
                var top = 0.0
                for i in 0..<arr.count {
                    let p = arr[i].doubleValue
                    expected += Double(i) * p
                    sum += p
                    top = max(top, p)
                }
                guard sum > 0 else { return nil }
                return RawPrediction(age: expected / sum,
                                     confidence: min(1.0, top * 4))
            }
            if feature.type == .double {
                return RawPrediction(age: feature.doubleValue, confidence: 0.8)
            }
        }
        return nil
    }

    private static func loadModel() -> VNCoreMLModel? {
        let candidates = ["AgeNetJP", "AgeNet", "AgeEstimator"]
        let config = MLModelConfiguration()
        config.computeUnits = .all // ANE + GPU + CPU
        for name in candidates {
            guard let url = Bundle.main.url(forResource: name, withExtension: "mlmodelc")
                ?? Bundle.main.url(forResource: name, withExtension: "mlmodel") else { continue }
            do {
                let ml = try MLModel(contentsOf: url, configuration: config)
                return try VNCoreMLModel(for: ml)
            } catch {
                continue
            }
        }
        return nil
    }
}
