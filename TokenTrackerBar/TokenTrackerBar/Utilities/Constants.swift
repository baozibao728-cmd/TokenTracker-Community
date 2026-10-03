import Foundation

enum Constants {
    static let serverBaseURL = "http://localhost:7682"
    static let serverPort = 7682
    static let dataRootURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".tokentracker-community", isDirectory: true)
    static let autoRefreshInterval: TimeInterval = 300
    static let healthCheckInterval: TimeInterval = 30
    static let maxHeatmapWeeks = 52
}
