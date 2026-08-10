# Huaban AI display firmware

USB display receiver for Waveshare ESP32-S3-RLCD-4.2.

## Dependencies

- ESP32 Arduino core
- U8g2

## Board settings

- Board: ESP32S3 Dev Module
- Flash: 16MB
- PSRAM: OPI PSRAM
- USB CDC On Boot: Enabled
- Upload mode: UART0 / Hardware CDC

The browser sends a 400x300 U8g2 page buffer over USB CDC using the `HUABAN1` protocol.
