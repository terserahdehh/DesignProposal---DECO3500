#include <cassert>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <regex>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
#include "../include/direction_layout.h"

using Pixel = std::pair<int, int>;

std::vector<unsigned> readActualFont(const char *path) {
  std::ifstream input(path);
  if (!input) throw std::runtime_error("Pass the installed TFT_eSPI Fonts/glcdfont.c path as argument");
  std::string source((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
  const auto first = source.find("= {");
  const auto last = source.find("};", first);
  assert(first != std::string::npos && last != std::string::npos);
  const std::string body = source.substr(first, last - first);
  const std::regex byte("0x([0-9a-fA-F]{2})");
  std::vector<unsigned> font;
  for (std::sregex_iterator item(body.begin(), body.end(), byte), end; item != end; ++item)
    font.push_back(std::stoul((*item)[1], nullptr, 16));
  assert(font.size() >= 128 * 5);
  return font;
}

std::set<Pixel> fontPixels(const RoundDisplayLabel &label, const std::vector<unsigned> &font) {
  assert(label.font == 1);
  const int left = label.x - int(std::strlen(label.text) * 6) / 2;
  const int top = label.y - 4; // TFT font1/MC_DATUM: six-pixel cells, eight-pixel height.
  std::set<Pixel> pixels;
  for (int character = 0; label.text[character]; ++character)
    for (int column = 0; column < 5; ++column)
      for (int row = 0; row < 8; ++row)
        if (font[static_cast<unsigned char>(label.text[character]) * 5 + column] & (1u << row))
          pixels.emplace(left + character * 6 + column, top + row);
  return pixels;
}

std::set<Pixel> arcPixels(double bearing) {
  const double radians = 3.14159265358979323846 / 180;
  std::set<Pixel> pixels;
  for (int step = -90; step <= 90; ++step) {
    const double angle = (bearing + step * 0.5) * radians;
    for (int radius = DIRECTION_ARC_INNER_RADIUS; radius <= DIRECTION_ARC_OUTER_RADIUS; ++radius)
      pixels.emplace(120 + std::lround(std::sin(angle) * radius),
                     120 - std::lround(std::cos(angle) * radius));
  }
  return pixels;
}

size_t overlap(const std::set<Pixel> &first, const std::set<Pixel> &second) {
  size_t count = 0;
  for (const auto &pixel : first) count += second.count(pixel);
  return count;
}

int main(int argc, char **argv) {
  const char *path = argc > 1 ? argv[1] : "hardware/.pio/libdeps/nayaka/TFT_eSPI/Fonts/glcdfont.c";
  const auto font = readActualFont(path);
  // The actual installed bitmap reproduces the old north/south lettering loss.
  assert(overlap(fontPixels({"P U L S E B A N D", 120, 25, 1}, font), arcPixels(0)) > 0);
  assert(overlap(fontPixels({"TOGETHER, FURTHER.", 120, 222, 1}, font), arcPixels(180)) > 0);

  const RoundDisplayLabel labels[] = {roundDisplayBranding(), roundDisplayFooterLeft(), roundDisplayFooterRight()};
  std::set<Pixel> allGlyphs;
  for (const auto &label : labels) {
    const auto glyphs = fontPixels(label, font);
    assert(!glyphs.empty());
    allGlyphs.insert(glyphs.begin(), glyphs.end());
    const int width = int(std::strlen(label.text)) * 6;
    const int left = label.x - width / 2, top = label.y - 4;
    // Include the white background of each complete cell, not only glyph ink.
    for (int y = top; y < top + 8; ++y) for (int x = left; x < left + width; ++x) {
      assert((x - 120) * (x - 120) + (y - 120) * (y - 120) <= 108 * 108);
      // SOS triangle edges are x=120 +/- 15*(y-192)/24 over y192..216.
      if (y >= 192 && y <= 216)
        assert(std::abs(x - 120) > 15.0 * (y - 192) / 24.0);
      // Active purple/yellow rings use radius13; a one-pixel margin covers
      // circle raster rounding. The other two indicators remain radius6.
      const int indicatorX[] = {48, 192, 48, 192}, indicatorY[] = {48, 48, 192, 192};
      for (int index = 0; index < 4; ++index) {
        int guard = (index == 0 || index == 3) ? 14 : 7;
        assert((x - indicatorX[index]) * (x - indicatorX[index]) +
               (y - indicatorY[index]) * (y - indicatorY[index]) > guard * guard);
      }
    }
  }
  for (int degree = 0; degree < 360; ++degree) {
    assert(overlap(allGlyphs, arcPixels(degree)) == 0);
    assert(overlap(allGlyphs, arcPixels(degree + 0.25)) == 0);
  }
  std::cout << "PASS: actual TFT font bitmaps clear the complete quarter arc, SOS and indicators at all bearings\n";
}
