import Foundation
import Vision
import ImageIO
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
try VNImageRequestHandler(url: url).perform([request])
let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
let data = try JSONSerialization.data(withJSONObject: ["text": text])
print(String(data: data, encoding: .utf8)!)
