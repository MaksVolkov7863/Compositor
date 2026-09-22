import AppKit
import SwiftUI
import Testing
@testable import Compositor

/// Serialized: these show real panels and run a display pass.
@MainActor @Suite(.serialized)
struct FloatingPanelTests {
    private func sessionWithPixels() throws -> EditorSession {
        let session = EditorSession()
        session.createDocument(width: 40, height: 20)
        let context = try BrushRaster.context(width: 40, height: 20, mask: false)
        context.setFillColor(CGColor(srgbRed: 1, green: 0, blue: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 40, height: 20))
        let image = try #require(context.makeImage())
        session.insert(ImportedImage(image: image, thumbnail: image, name: "Red"))
        return session
    }
    /// Lets AppKit run its constraint/display pass, which is where hosting used to crash.
    private func settle() { RunLoop.main.run(until: Date().addingTimeInterval(0.4)) }

    /// Cmd+U used to crash here: `.preferredContentSize` sizing made AppKit measure the
    /// SwiftUI view during its constraint pass, and the measurement invalidated layout
    /// re-entrantly, which AppKit turns into a fatal exception.
    @Test func hueSaturationPanelSurvivesALayoutPass() async throws {
        let session = try sessionWithPixels()
        session.beginHueSaturation()
        #expect(session.hueSaturation != nil)
        let panel = FloatingPanelController(name: "testHueSaturationPanel")
        panel.show(title: "Hue/Saturation", content: HueSaturationSheet(session: session))
        settle()
        #expect(panel.isVisible)
        // Previewing while the panel is hosted must also survive a display pass.
        session.updateHueSaturation(HueSaturationSettings(hue: 40), preview: true)
        await session.hueSaturationTask?.value
        settle()
        panel.close()
        session.cancelHueSaturation()
        #expect(!panel.isVisible && session.hueSaturation == nil)
    }

    @Test func colorPickerPanelSurvivesALayoutPass() throws {
        let session = try sessionWithPixels()
        session.openColorPicker(background: false)
        let controller = ColorPickerPanelController()
        controller.show(try #require(session.colorPicker), session: session)
        settle()
        let panel = try #require(NSApp.windows.first { $0.identifier == ColorPickerPanelController.identifier })
        #expect(panel.isVisible && panel.contentView != nil)
        controller.close()
        session.closeColorPicker(commit: false)
    }
    // Invert has no settings and so no editor; it is covered on its own.
    @Test(arguments: AdjustmentKind.allCases.filter(\.isEditable))
    func adjustmentEditorsUseMovableNonmodalPanels(_ kind: AdjustmentKind) async throws {
        let session = try sessionWithPixels()
        session.addAdjustment(kind)
        await session.beginAdjustmentEditing(try #require(session.adjustmentEditingID))
        let controller = FloatingPanelController(name: "testDynamicAdjustmentPanel")
        controller.onClose = { session.finishAdjustmentEditing(commit: false) }
        switch kind {
        case .levels: controller.show(title: "Levels", content: LevelsSheet(session: session))
        case .hsv: controller.show(title: "Hue/Saturation", content: HueSaturationSheet(session: session))
        case .curves, .exposure, .gradientMap, .grain, .blackWhite, .colorBalance, .gaussianBlur, .motionBlur, .addNoise:
            controller.show(title: kind.rawValue, content: FilterSheet(session: session))
        case .invert: return   // filtered out above: no editor, so no panel to test
        }
        settle()
        let panel = try #require(NSApp.windows.first { $0.identifier == controller.identifier })
        #expect(panel.isVisible && panel.isMovable && !panel.isSheet)
        #expect(panel.sheetParent == nil && !session.showsBusy)
        let origin = panel.frame.origin
        panel.setFrameOrigin(NSPoint(x: origin.x + 20, y: origin.y + 20))
        #expect(panel.frame.origin != origin)
        panel.performClose(nil)
        #expect(session.adjustmentEditingID == nil)
        #expect(session.levels == nil && session.hueSaturation == nil && session.filterEdit == nil)
    }

    /// Camera Raw docks to the document window. That frame must not become the place
    /// Gaussian Blur and the other filters reopen.
    @Test func dockedPlacementLeavesTheSavedFilterPosition() throws {
        let window = NSWindow(contentRect: NSRect(x: 80, y: 80, width: 900, height: 700),
                              styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
        window.makeKeyAndOrderFront(nil)
        let controller = FloatingPanelController(name: "testDockedFilterPosition")
        controller.show(title: "Gaussian Blur", content: Text("Blur"))
        settle()
        let panel = try #require(NSApp.windows.first { $0.identifier == controller.identifier })
        let parked = NSPoint(x: 40, y: 240)
        panel.setFrameOrigin(parked)
        let saved = NSPoint(x: panel.frame.minX, y: panel.frame.maxY)
        controller.close()

        controller.show(title: "Camera Raw Filter", content: Text("Camera Raw"), placement: .dockedToMainWindowRight)
        settle()
        #expect(panel.isVisible)
        #expect(abs(panel.frame.maxX - window.frame.maxX) < 2)
        controller.close()

        controller.show(title: "Gaussian Blur", content: Text("Blur"))
        settle()
        let restored = NSPoint(x: panel.frame.minX, y: panel.frame.maxY)
        #expect(abs(restored.x - saved.x) < 2 && abs(restored.y - saved.y) < 2,
                "the filter panel reopens where it was left, not on the docked edge: \(restored)")
        controller.close()
        window.close()
    }

    /// Dragging the document window posts a move, not a resize. The docked panel has to follow both.
    @Test func dockedPlacementFollowsTheDocumentWindow() throws {
        let window = NSWindow(contentRect: NSRect(x: 120, y: 140, width: 900, height: 700),
                              styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
        window.makeKeyAndOrderFront(nil)
        let controller = FloatingPanelController(name: "testDockedFilterFollows")
        controller.show(title: "Camera Raw Filter", content: Text("Camera Raw"), placement: .dockedToMainWindowRight)
        settle()
        let panel = try #require(NSApp.windows.first { $0.identifier == controller.identifier })
        #expect(abs(panel.frame.maxX - window.frame.maxX) < 2 && abs(panel.frame.minY - window.frame.minY) < 2)

        window.setFrameOrigin(NSPoint(x: window.frame.origin.x + 90, y: window.frame.origin.y + 50))
        settle()
        #expect(abs(panel.frame.maxX - window.frame.maxX) < 2 && abs(panel.frame.minY - window.frame.minY) < 2,
                "the panel stays on the window's right edge after a drag")
        let height = window.frame.height
        window.setFrame(NSRect(x: window.frame.origin.x, y: window.frame.origin.y, width: window.frame.width, height: height - 80), display: true)
        settle()
        #expect(abs(panel.frame.height - window.frame.height) < 2 && abs(panel.frame.maxX - window.frame.maxX) < 2,
                "the panel still matches the window after a resize")
        controller.close()
        window.close()
    }

}
