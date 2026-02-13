#include <windows.h>
#include <iostream>

extern "C" {
    __declspec(dllexport) DWORD GetIdleTime() {
        LASTINPUTINFO lii;
        lii.cbSize = sizeof(LASTINPUTINFO);
        if (GetLastInputInfo(&lii)) {
            DWORD tickCount = GetTickCount();
            return tickCount - lii.dwTime; // milliseconds since last input
        }
        return 0;
    }
}
