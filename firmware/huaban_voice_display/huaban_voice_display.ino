#include "ST7305_U8g2.h"
#include <FFat.h>

#define LCD_WIDTH 400
#define LCD_HEIGHT 300
#define FRAME_BYTES (((LCD_WIDTH + 7) / 8) * LCD_HEIGHT)
#define USB_CHUNK_BYTES 256

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

static ButtonState keyButton = {KEY_PIN, HIGH, HIGH, 0};
static ButtonState bootButton = {BOOT_PIN, HIGH, HIGH, 0};

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

static void handleButtons() {
  handleButton(keyButton, -1);
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
