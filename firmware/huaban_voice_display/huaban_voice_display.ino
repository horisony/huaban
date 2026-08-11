#include "ST7305_U8g2.h"

#define LCD_WIDTH 400
#define LCD_HEIGHT 300
#define FRAME_BYTES (((LCD_WIDTH + 7) / 8) * LCD_HEIGHT)
#define USB_CHUNK_BYTES 256

#define RLCD_SCK_PIN 11
#define RLCD_MOSI_PIN 12
#define RLCD_DC_PIN 5
#define RLCD_CS_PIN 40
#define RLCD_RST_PIN 41

static ST7305_U8g2 lcd(RLCD_SCK_PIN, RLCD_MOSI_PIN, RLCD_DC_PIN, RLCD_CS_PIN, RLCD_RST_PIN);
static U8G2 *u8g2 = nullptr;
static uint8_t frame[FRAME_BYTES];

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

void setup() {
  Serial.begin(921600);
  Serial.setTimeout(1000);
  lcd.begin(0, U8G2_R1);
  u8g2 = lcd.getU8g2();
  showStatus("Huaban AI", "Connect USB in the browser");
  Serial.println("HUABAN_READY");
}

void loop() {
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

  u8g2->clearBuffer();
  u8g2->setDrawColor(1);
  u8g2->drawXBMP(0, 0, LCD_WIDTH, LCD_HEIGHT, frame);
  u8g2->sendBuffer();
  Serial.println("HUABAN_OK");
}
