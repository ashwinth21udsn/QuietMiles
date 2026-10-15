# Quiet Miles 2.0 (Android source)

An endless, calm driving game. You drive: steering wheel, gas, brake, gear (D/R), headlights, horn.
The game is plain HTML + CSS + JavaScript (three.js bundled, no internet needed) shown full screen
in an Android WebView, so you can change the game by editing files in `app/src/main/assets/`.

## Build the APK

**Android Studio (easiest)**
1. File > Open, choose this folder. Let Gradle sync finish (it downloads what it needs).
2. Build > Build Bundle(s) / APK(s) > Build APK(s).
3. Click "locate" in the pop-up. The file is `app/build/outputs/apk/debug/app-debug.apk`.
4. Copy it to your phone and open it (allow "install unknown apps" once), or run the app from Studio with a USB phone.

**Command line** (needs JDK 17 and the Android SDK; set `ANDROID_HOME`)
```
./gradlew assembleDebug
```

**No Android Studio?** Push this folder to a GitHub repository. `.github/workflows/build-apk.yml`
builds the APK for you; download it from the run's Artifacts (`QuietMiles-debug-apk`).

**For the Play Store or sharing widely:** Build > Generate Signed Bundle / APK in Android Studio
(a debug APK works for your own phone only in the sense that it is signed with a debug key).

Requirements: Android 8.0 (API 26) or newer. The app is locked to landscape. No permissions are used.

## Controls

| Control | What it does |
|---|---|
| Steering wheel (bottom left) | Drag around its centre. Let go and it returns to centre. Settings can switch it to two side buttons. |
| GAS / BRAKE (bottom right) | Hold. Braking while stopped keeps the car still. |
| D / R button | Drive or reverse. Only changes when the car is almost stopped. |
| Horn | Hold. |
| Headlight button (top) | Cycles off, low beam, high beam. |
| Camera | Chase, high, or hood view. |
| Garage | Six vehicles and nine paint colours. |
| Eye | Hides the interface for screenshots. |
| Settings | Time of day, weather, sound, steering control, km/h or mph, picture quality, "Back on the road", "New road". |

Keyboard (when testing in a browser): W/S or arrows, A/D, Space = brake, R = gear, L = lights, H = horn, C = camera, G = garage.

## Where things are

```
app/src/main/assets/
  index.html          page and on-screen controls
  css/style.css       look of the interface
  js/world.js         noise, endless road, landscapes (meadow, autumn woods, pine highlands, dunes)
  js/vehicles.js      the six vehicles (edit the VEHICLES list to tune speed, grip, size, colour)
  js/scene.js         terrain, road, grass, flowers, dead trees, bushes, cacti, fences, sky, clouds, rain
  js/environment.js   time of day and weather
  js/audio.js         synthesised music, wind, rain, birds, engine, horn (no sound files)
  js/game.js          driving physics, camera, controls, speedometer, menus, main loop
app/src/main/java/com/quietmiles/game/MainActivity.java   full-screen WebView host
```

To preview in a desktop browser without Android: open `app/src/main/assets/index.html` in Chrome.

## Honest notes
- The game code was run and checked in a desktop browser (no errors, all six vehicles, driving, braking, reverse, menus).
  The Android wrapper itself could not be compiled where this was written, so the first Gradle sync and
  build is the first real test of it.
- Performance on older phones: use Settings > Picture quality > Light.
