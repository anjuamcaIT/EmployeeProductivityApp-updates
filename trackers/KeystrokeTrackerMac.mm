#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>

extern "C" {
    uint64_t GetIdleTime() {
        CFTimeInterval idle = CGEventSourceSecondsSinceLastEventType(kCGEventSourceStateCombinedSessionState,
                                                                     kCGAnyInputEventType);
        return (uint64_t)(idle * 1000); // milliseconds
    }
}
