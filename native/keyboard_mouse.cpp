 
#include <napi.h>
#include <windows.h>


Napi::ThreadSafeFunction tsfnKeyboard;
Napi::ThreadSafeFunction tsfnMouse;
Napi::ThreadSafeFunction tsfnSystem;// New Code
POINT lastMousePos = {0, 0};
bool hasLastPos = false;

DWORD GetIdleTimeMs() {
    LASTINPUTINFO lii;
    lii.cbSize = sizeof(LASTINPUTINFO);
    if (GetLastInputInfo(&lii)) {
        return GetTickCount() - lii.dwTime;
    }
    return 0;
}

DWORD WINAPI SystemActivityThread(LPVOID param); // forward declaration

// ==================== Keyboard ====================
LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && tsfnKeyboard) {
        KBDLLHOOKSTRUCT *kbStruct = (KBDLLHOOKSTRUCT*)lParam;
        DWORD vkCode = kbStruct->vkCode;

        tsfnKeyboard.BlockingCall([vkCode](Napi::Env env, Napi::Function jsCallback) {
            jsCallback.Call({ Napi::Number::New(env, vkCode) });
        });
    }
    return CallNextHookEx(NULL, nCode, wParam, lParam);
}



 

DWORD WINAPI KeyboardThread(LPVOID param) {
    HHOOK keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, NULL, 0);
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    UnhookWindowsHookEx(keyboardHook);
    return 0;
}

Napi::Value StartKeyboardHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Function jsCallback = info[0].As<Napi::Function>();

    tsfnKeyboard = Napi::ThreadSafeFunction::New(
        env,
        jsCallback,
        "KeyboardHook",
        0,
        1
    );

    CreateThread(NULL, 0, KeyboardThread, NULL, 0, NULL);
    return env.Undefined();
} 

LRESULT CALLBACK LowLevelMouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && tsfnMouse) {
        MSLLHOOKSTRUCT* mouseStruct = (MSLLHOOKSTRUCT*)lParam;
        POINT currentPos = mouseStruct->pt;

        bool isMovement = false;

        // Track movement
        if (hasLastPos) {
            int dx = abs(currentPos.x - lastMousePos.x);
            int dy = abs(currentPos.y - lastMousePos.y);
            if ((dx + dy) > 20) { // threshold
                isMovement = true;
                lastMousePos = currentPos;
            }
        } else {
            hasLastPos = true;
            lastMousePos = currentPos;
        }

        // Track clicks
        bool isClick = (wParam == WM_LBUTTONDOWN || wParam == WM_RBUTTONDOWN ||
                        wParam == WM_MBUTTONDOWN || wParam == WM_XBUTTONDOWN);

        // Only emit if movement or click
        if (isMovement || isClick) {
            tsfnMouse.BlockingCall([wParam](Napi::Env env, Napi::Function jsCallback) {
                jsCallback.Call({ Napi::Number::New(env, wParam) });
            });
        }
    }

    return CallNextHookEx(NULL, nCode, wParam, lParam);
}


DWORD WINAPI MouseThread(LPVOID param) {
    HHOOK mouseHook = SetWindowsHookEx(WH_MOUSE_LL, LowLevelMouseProc, NULL, 0);
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    UnhookWindowsHookEx(mouseHook);
    return 0;
}

Napi::Value StartMouseHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Function jsCallback = info[0].As<Napi::Function>();

    tsfnMouse = Napi::ThreadSafeFunction::New(
        env,
        jsCallback,
        "MouseHook",
        0,
        1
    );

    CreateThread(NULL, 0, MouseThread, NULL, 0, NULL);
    return env.Undefined();
}

// NEW
Napi::Value StartSystemActivityHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Function jsCallback = info[0].As<Napi::Function>();

    tsfnSystem = Napi::ThreadSafeFunction::New(
        env,
        jsCallback,
        "SystemActivityHook",
        0,
        1
    );

    // Start the thread to monitor system activity (remote input, etc.)
    CreateThread(NULL, 0, SystemActivityThread, NULL, 0, NULL);

    return env.Undefined();
}
// NEW END

// ==================== Module Exports ====================
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startKeyboardHook", Napi::Function::New(env, StartKeyboardHook));
    exports.Set("startMouseHook", Napi::Function::New(env, StartMouseHook));
    exports.Set("startSystemHook", Napi::Function::New(env, StartSystemActivityHook)); 
    return exports;
}
DWORD WINAPI SystemActivityThread(LPVOID param) {
    DWORD lastIdle = GetIdleTimeMs(); // initialize

    while (true) {
        Sleep(1000);

        DWORD currentIdle = GetIdleTimeMs();

        // Only fire if idle decreased
        if (currentIdle < lastIdle) {
            if (tsfnSystem) {
                tsfnSystem.BlockingCall([](Napi::Env env, Napi::Function cb) {
                    cb.Call({});
                });
            }
        }

        lastIdle = currentIdle;
    }
}
NODE_API_MODULE(keyboard_mouse, Init)
