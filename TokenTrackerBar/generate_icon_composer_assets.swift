#!/usr/bin/env swift
import Foundation

private let generatorRelativePath = "scripts/generate-brand-icons.cjs"

private enum GeneratorError: LocalizedError {
    case repositoryRootNotFound
    case unexpectedArguments
    case failed(Int32)

    var errorDescription: String? {
        switch self {
        case .repositoryRootNotFound:
            return "Could not locate the repository root containing \(generatorRelativePath)."
        case .unexpectedArguments:
            return "Usage: swift generate_icon_composer_assets.swift [output-directory]"
        case .failed(let status):
            return "Brand icon generator exited with status \(status)."
        }
    }
}

private func repositoryRoot() throws -> URL {
    let fileManager = FileManager.default
    let seeds = [
        URL(fileURLWithPath: #filePath, isDirectory: false)
            .standardizedFileURL
            .deletingLastPathComponent(),
        URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
            .standardizedFileURL
    ]

    for seed in seeds {
        var candidate = seed
        while true {
            let generator = candidate.appendingPathComponent(generatorRelativePath)
            if fileManager.fileExists(atPath: generator.path) {
                return candidate
            }

            let parent = candidate.deletingLastPathComponent()
            if parent.path == candidate.path { break }
            candidate = parent
        }
    }

    throw GeneratorError.repositoryRootNotFound
}

private func runGenerator() throws {
    guard CommandLine.arguments.count <= 2 else {
        throw GeneratorError.unexpectedArguments
    }

    let root = try repositoryRoot()
    let generator = root.appendingPathComponent(generatorRelativePath)
    var arguments = [
        "node",
        generator.path,
        "--macos",
        "--output-root",
        root.path
    ]

    // Keep the original positional output-directory contract for callers that
    // want only the Icon Composer layer SVGs in a temporary location.
    if CommandLine.arguments.count == 2 {
        arguments.append(contentsOf: ["--icon-assets-dir", CommandLine.arguments[1]])
    }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = arguments
    process.standardOutput = FileHandle.standardOutput
    process.standardError = FileHandle.standardError
    try process.run()
    process.waitUntilExit()

    guard process.terminationStatus == 0 else {
        throw GeneratorError.failed(process.terminationStatus)
    }
}

try runGenerator()
