{
  "targets": [
    {
      "target_name": "keyboard_mouse",
      "sources": ["keyboard_mouse.cpp"], 
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS=1"]
    }
  ]
}
