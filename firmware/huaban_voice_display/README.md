# Huaban AI display firmware

USB display receiver for Waveshare ESP32-S3-RLCD-4.2.

It also supports standalone push-to-talk drawing:

- short press `KEY`: previous saved drawing
- hold `KEY` for 700 ms: start recording from the onboard ES7210 microphones
- release `KEY`: upload the WAV recording, transcribe it, generate a drawing, and display it
- short press `BOOT`: next saved drawing

## Dependencies

- ESP32 Arduino core
- U8g2
- ESP32 Arduino core 3.x (the official ES7210 driver uses ESP-IDF 5 APIs)

## Board settings

- Board: ESP32S3 Dev Module
- Flash: 16MB
- PSRAM: OPI PSRAM
- USB CDC On Boot: Enabled
- Upload mode: UART0 / Hardware CDC

The browser sends a 400x300 U8g2 page buffer over USB CDC using the `HUABAN1` protocol.

## Standalone setup

1. Copy `secrets.example.h` to `secrets.h`.
2. Fill in a 2.4 GHz Wi-Fi SSID/password and the public HTTPS deployment URL.
3. Set the same long random `HUABAN_DEVICE_TOKEN` in `secrets.h` and in the server environment. The prototype deployment may instead store only its SHA-256 hash server-side.
4. Deploy the web service, then flash this sketch with PSRAM enabled.

The OpenAI API key stays on the server. Never put it in `secrets.h` or firmware.
The device endpoint accepts a bounded WAV recording and returns exactly 15,000 bytes in the display's native 400x300 1-bit format.

The ES7210/ES8311 codec sources under `src/ExternLib` come from Waveshare's official
`ESP32-S3-RLCD-4.2/02_Example/Arduino/07_Audio_Test` example and retain their upstream licenses.
