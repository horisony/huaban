#include "ST7305_U8g2.h"
#include "codec_bsp.h"
#include "i2c_bsp.h"
#include <FFat.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_heap_caps.h>

#if __has_include("secrets.h")
#include "secrets.h"
#define HUABAN_STANDALONE_ENABLED 1
#else
#define HUABAN_STANDALONE_ENABLED 0
#endif

#define LCD_WIDTH 400
#define LCD_HEIGHT 300
#define FRAME_BYTES (((LCD_WIDTH + 7) / 8) * LCD_HEIGHT)
#define USB_CHUNK_BYTES 256
#define KEY_LONG_PRESS_MS 700
#define AUDIO_SAMPLE_RATE 16000
#define AUDIO_CHANNELS 2
#define AUDIO_BITS_PER_SAMPLE 16
#define AUDIO_MAX_SECONDS 20
#define WAV_HEADER_BYTES 44
#define AUDIO_BYTES_PER_SECOND (AUDIO_SAMPLE_RATE * AUDIO_CHANNELS * (AUDIO_BITS_PER_SAMPLE / 8))
#define AUDIO_MAX_BYTES (AUDIO_BYTES_PER_SECOND * AUDIO_MAX_SECONDS)

#define RLCD_SCK_PIN 11
#define RLCD_MOSI_PIN 12
#define RLCD_DC_PIN 5
#define RLCD_CS_PIN 40
#define RLCD_RST_PIN 41
#define KEY_PIN 18
#define BOOT_PIN 0

#define GALLERY_MAGIC 0x4842414eUL

static ST7305_U8g2 lcd(RLCD_SCK_PIN, RLCD_MOSI_PIN, RLCD_DC_PIN, RLCD_CS_PIN, RLCD_RST_PIN);
static U8G2 *u8g2 = nullptr;
static uint8_t frame[FRAME_BYTES];
static bool storageReady = false;
static I2cMasterBus *audioI2c = nullptr;
static CodecPort *codec = nullptr;
static uint8_t *audioBuffer = nullptr;
static size_t audioLength = 0;
static bool recording = false;
static bool keyPressed = false;
static bool keyLongPress = false;
static bool keyRawPressed = false;
static bool keyStablePressed = false;
static uint32_t keyChangedAt = 0;
static uint32_t keyPressedAt = 0;

struct GalleryState {
  uint32_t magic;
  uint32_t count;
  uint32_t current;
};

static GalleryState gallery = {GALLERY_MAGIC, 0, 0};

struct ButtonState {
  uint8_t pin;
  bool stable;
  bool reading;
  uint32_t changedAt;
};

static ButtonState bootButton = {BOOT_PIN, HIGH, HIGH, 0};

static bool loadDrawing(uint32_t index);
static bool saveCurrentDrawing();

static void writeLe16(uint8_t *target, uint16_t value) {
  target[0] = value & 0xff;
  target[1] = (value >> 8) & 0xff;
}

static void writeLe32(uint8_t *target, uint32_t value) {
  target[0] = value & 0xff;
  target[1] = (value >> 8) & 0xff;
  target[2] = (value >> 16) & 0xff;
  target[3] = (value >> 24) & 0xff;
}

static void finishWavHeader() {
  uint32_t pcmLength = audioLength > WAV_HEADER_BYTES ? audioLength - WAV_HEADER_BYTES : 0;
  memcpy(audioBuffer, "RIFF", 4);
  writeLe32(audioBuffer + 4, pcmLength + 36);
  memcpy(audioBuffer + 8, "WAVEfmt ", 8);
  writeLe32(audioBuffer + 16, 16);
  writeLe16(audioBuffer + 20, 1);
  writeLe16(audioBuffer + 22, AUDIO_CHANNELS);
  writeLe32(audioBuffer + 24, AUDIO_SAMPLE_RATE);
  writeLe32(audioBuffer + 28, AUDIO_BYTES_PER_SECOND);
  writeLe16(audioBuffer + 32, AUDIO_CHANNELS * (AUDIO_BITS_PER_SAMPLE / 8));
  writeLe16(audioBuffer + 34, AUDIO_BITS_PER_SAMPLE);
  memcpy(audioBuffer + 36, "data", 4);
  writeLe32(audioBuffer + 40, pcmLength);
}

static bool readExact(uint8_t *data, size_t length, uint32_t timeoutMs) {
  size_t received = 0;
  uint32_t lastByteAt = millis();
  while (received < length && millis() - lastByteAt < timeoutMs) {
    if (!Serial.available()) {
      delay(1);
      continue;
    }
    int value = Serial.read();
    if (value < 0) continue;
    data[received++] = (uint8_t)value;
    lastByteAt = millis();
  }
  return received == length;
}

static bool waitForHeader() {
  static const char magic[] = "HUABAN1\n";
  static size_t matched = 0;
  while (Serial.available()) {
    char value = (char)Serial.read();
    if (value == magic[matched]) {
      matched++;
      if (matched == sizeof(magic) - 1) {
        matched = 0;
        return true;
      }
    } else {
      matched = value == magic[0] ? 1 : 0;
    }
  }
  return false;
}

static void showStatus(const char *line1, const char *line2 = nullptr) {
  u8g2->clearBuffer();
  u8g2->setDrawColor(1);
  u8g2->setFont(u8g2_font_helvB18_tf);
  u8g2->drawStr(18, 120, line1);
  if (line2) {
    u8g2->setFont(u8g2_font_helvR12_tf);
    u8g2->drawStr(18, 155, line2);
  }
  u8g2->drawFrame(8, 8, 384, 284);
  u8g2->sendBuffer();
}

static void displayFrame() {
  u8g2->clearBuffer();
  u8g2->setDrawColor(1);
  u8g2->drawXBMP(0, 0, LCD_WIDTH, LCD_HEIGHT, frame);
  u8g2->sendBuffer();
}

static void restoreGalleryView() {
  if (gallery.current > 0 && loadDrawing(gallery.current)) return;
  showStatus("Huaban AI", storageReady ? "Gallery ready" : "Storage unavailable");
}

#if HUABAN_STANDALONE_ENABLED
static bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  showStatus("Connecting...", "Joining Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(HUABAN_WIFI_SSID, HUABAN_WIFI_PASSWORD);
  uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

static bool requestDrawing() {
  if (audioLength <= WAV_HEADER_BYTES + AUDIO_BYTES_PER_SECOND / 4) {
    showStatus("Too short", "Hold KEY and speak again");
    delay(1800);
    return false;
  }
  finishWavHeader();
  if (!connectWifi()) {
    showStatus("Wi-Fi failed", "Check secrets.h");
    delay(2200);
    return false;
  }

  showStatus("Drawing...", "AI is making your picture");
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(120000);
  if (!http.begin(client, HUABAN_DEVICE_URL)) return false;
  http.addHeader("Content-Type", "audio/wav");
  if (strlen(HUABAN_DEVICE_TOKEN)) {
    http.addHeader("Authorization", String("Bearer ") + HUABAN_DEVICE_TOKEN);
  }
  int status = http.POST(audioBuffer, audioLength);
  int contentLength = http.getSize();
  bool ok = status == HTTP_CODE_OK && (contentLength == FRAME_BYTES || contentLength < 0);
  if (ok) {
    WiFiClient *stream = http.getStreamPtr();
    size_t received = stream->readBytes(frame, FRAME_BYTES);
    ok = received == FRAME_BYTES;
  }
  http.end();

  if (!ok) {
    showStatus("Drawing failed", "Check Wi-Fi and server");
    delay(2200);
    return false;
  }
  displayFrame();
  bool saved = saveCurrentDrawing();
  Serial.println(saved ? "HUABAN_VOICE_OK" : "HUABAN_VOICE_NOT_SAVED");
  return true;
}
#endif

static void startRecording() {
#if HUABAN_STANDALONE_ENABLED
  if (!codec || !audioBuffer) {
    showStatus("Mic unavailable", "Restart and try again");
    return;
  }
  audioLength = WAV_HEADER_BYTES;
  recording = true;
  showStatus("Listening...", "Release KEY when finished");
  Serial.println("HUABAN_LISTENING");
#else
  showStatus("Not configured", "Create secrets.h first");
#endif
}

static void captureAudioChunk() {
#if HUABAN_STANDALONE_ENABLED
  if (!recording || audioLength >= WAV_HEADER_BYTES + AUDIO_MAX_BYTES) return;
  size_t remaining = WAV_HEADER_BYTES + AUDIO_MAX_BYTES - audioLength;
  size_t chunk = min((size_t)1024, remaining);
  if (codec->CodecPort_EchoRead(audioBuffer + audioLength, chunk) == ESP_CODEC_DEV_OK) {
    audioLength += chunk;
  }
#endif
}

static void stopRecording() {
  if (!recording) return;
  recording = false;
  showStatus("Got it", "Sending your words...");
#if HUABAN_STANDALONE_ENABLED
  if (!requestDrawing()) restoreGalleryView();
#endif
}

static void drawingPath(uint32_t index, char *path, size_t pathSize) {
  snprintf(path, pathSize, "/drawing_%06lu.xbm", (unsigned long)index);
}

static bool saveGalleryState() {
  if (!storageReady) return false;
  File file = FFat.open("/gallery.state", FILE_WRITE);
  if (!file) return false;
  bool ok = file.write((const uint8_t *)&gallery, sizeof(gallery)) == sizeof(gallery);
  file.close();
  return ok;
}

static bool loadDrawing(uint32_t index) {
  if (!storageReady || index < 1 || index > gallery.count) return false;
  char path[32];
  drawingPath(index, path, sizeof(path));
  File file = FFat.open(path, FILE_READ);
  if (!file || file.size() != FRAME_BYTES) {
    if (file) file.close();
    return false;
  }
  bool ok = file.read(frame, FRAME_BYTES) == FRAME_BYTES;
  file.close();
  if (!ok) return false;
  gallery.current = index;
  saveGalleryState();
  displayFrame();
  Serial.printf("HUABAN_VIEW %lu %lu\n", (unsigned long)gallery.current, (unsigned long)gallery.count);
  return true;
}

static bool saveCurrentDrawing() {
  if (!storageReady || FFat.totalBytes() - FFat.usedBytes() < FRAME_BYTES + 512) return false;
  uint32_t index = gallery.count + 1;
  char path[32];
  drawingPath(index, path, sizeof(path));
  File file = FFat.open(path, FILE_WRITE);
  if (!file) return false;
  bool ok = file.write(frame, FRAME_BYTES) == FRAME_BYTES;
  file.close();
  if (!ok) {
    FFat.remove(path);
    return false;
  }
  gallery.count = index;
  gallery.current = index;
  saveGalleryState();
  return true;
}

static void handleButton(ButtonState &button, int direction) {
  bool reading = digitalRead(button.pin);
  if (reading != button.reading) {
    button.reading = reading;
    button.changedAt = millis();
  }
  if (reading == button.stable || millis() - button.changedAt < 35) return;
  button.stable = reading;
  if (button.stable != LOW || gallery.count == 0) return;
  int64_t target = (int64_t)gallery.current + direction;
  if (target < 1) target = gallery.count;
  if (target > gallery.count) target = 1;
  loadDrawing((uint32_t)target);
}

static void handleKeyButton() {
  bool rawPressed = digitalRead(KEY_PIN) == LOW;
  if (rawPressed != keyRawPressed) {
    keyRawPressed = rawPressed;
    keyChangedAt = millis();
  }
  if (keyStablePressed != keyRawPressed && millis() - keyChangedAt >= 35) {
    keyStablePressed = keyRawPressed;
  }
  bool pressed = keyStablePressed;
  if (pressed && !keyPressed) {
    keyPressed = true;
    keyLongPress = false;
    keyPressedAt = millis();
  }
  if (pressed && !keyLongPress && millis() - keyPressedAt >= KEY_LONG_PRESS_MS) {
    keyLongPress = true;
    startRecording();
  }
  if (pressed && keyLongPress) captureAudioChunk();
  if (!pressed && keyPressed) {
    keyPressed = false;
    if (keyLongPress) stopRecording();
    else if (gallery.count > 0) {
      uint32_t target = gallery.current <= 1 ? gallery.count : gallery.current - 1;
      loadDrawing(target);
    }
  }
}

static void handleButtons() {
  handleKeyButton();
  handleButton(bootButton, 1);
}

static void initStorage() {
  storageReady = FFat.begin(true);
  if (!storageReady) return;
  File file = FFat.open("/gallery.state", FILE_READ);
  if (file && file.size() == sizeof(gallery)) {
    GalleryState saved;
    if (file.read((uint8_t *)&saved, sizeof(saved)) == sizeof(saved)
        && saved.magic == GALLERY_MAGIC
        && saved.current <= saved.count) {
      gallery = saved;
    }
  }
  if (file) file.close();
}

void setup() {
  Serial.begin(921600);
  Serial.setTimeout(1000);
  pinMode(KEY_PIN, INPUT_PULLUP);
  pinMode(BOOT_PIN, INPUT_PULLUP);
  lcd.begin(0, U8G2_R1);
  u8g2 = lcd.getU8g2();
  initStorage();
#if HUABAN_STANDALONE_ENABLED
  audioBuffer = (uint8_t *)heap_caps_malloc(WAV_HEADER_BYTES + AUDIO_MAX_BYTES, MALLOC_CAP_SPIRAM);
  if (audioBuffer) {
    audioI2c = new I2cMasterBus(14, 13, 0);
    codec = new CodecPort(*audioI2c, "S3_RLCD_4_2");
    codec->CodecPort_SetInfo("es7210", 1, AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, AUDIO_BITS_PER_SAMPLE);
    codec->CodecPort_SetMicGain(35);
  }
#endif
  if (gallery.current == 0 || !loadDrawing(gallery.current)) {
    showStatus("Huaban AI", storageReady ? "Gallery ready" : "Storage unavailable");
  }
  Serial.println("HUABAN_READY");
}

void loop() {
  handleButtons();
  if (!waitForHeader()) {
    delay(2);
    return;
  }

  uint8_t lengthBytes[4];
  if (!readExact(lengthBytes, sizeof(lengthBytes), 2000)) return;
  uint32_t length = (uint32_t)lengthBytes[0]
    | ((uint32_t)lengthBytes[1] << 8)
    | ((uint32_t)lengthBytes[2] << 16)
    | ((uint32_t)lengthBytes[3] << 24);
  if (length != FRAME_BYTES) {
    showStatus("Bad frame", "Expected 15000 bytes");
    return;
  }

  Serial.println("HUABAN_GO");
  size_t received = 0;
  while (received < FRAME_BYTES) {
    size_t chunkLength = min((size_t)USB_CHUNK_BYTES, (size_t)FRAME_BYTES - received);
    if (!readExact(frame + received, chunkLength, 10000)) {
      showStatus("USB timeout", "Please send the picture again");
      Serial.println("HUABAN_TIMEOUT");
      return;
    }
    received += chunkLength;
    Serial.println("HUABAN_NEXT");
  }

  displayFrame();
  bool saved = saveCurrentDrawing();
  Serial.println("HUABAN_OK");
  if (saved) {
    Serial.printf("HUABAN_SAVED %lu\n", (unsigned long)gallery.count);
  } else {
    Serial.println("HUABAN_NOT_SAVED");
  }
}
