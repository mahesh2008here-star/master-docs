# MASTER DOCS — All-in-One Offline Android Document Reader

**MASTER DOCS** is a production-grade, offline-first Android document reader featuring a distinctive retro tactile design language, a floating translucent liquid glass navigation dock, interactive Material color theme customization, and robust local document rendering.

---

## 🌟 Key Features

- **100% On-Device Vault**: Zero-cloud document storage using IndexedDB & Android Storage Access Framework. No cloud sync, no tracking, total privacy.
- **Multi-Format Document Reader**:
  - **PDF**: Page navigation, jump-to-page, continuous scroll, canvas rendering, zoom scaling, text search, bookmarks, and paper tone themes.
  - **Word (DOCX)**: Heading hierarchy, formatted paragraphs, lists, bold/italics, and table parsing.
  - **Spreadsheet (XLSX / CSV)**: Sheet tab switcher, row/column grid rendering, scrollable tables, and formula view.
  - **Presentation (PPTX)**: Slide thumbnails, slide navigation, title & bullet list rendering.
  - **Text & Markdown (TXT / MD)**: Code blocks, blockquotes, lists, headers, and formatted typography.
- **Liquid Glass Navigation Dock**: Floating bottom dock with spring animations and smooth active tab layout indicators.
- **Interactive Material Color Picker**: Customizable accent colors with live theme preview across all buttons, progress bars, and badges.
- **Native Android Integration**: Single shared React + Capacitor codebase targeting Android API 23+.

---

## 🛠️ Requirements & Technical Stack

- **Node.js**: v18 LTS or v20 LTS
- **JDK**: Java 17
- **Android SDK**: API Level 34 (Compile & Target SDK)
- **Frameworks**: React 19, TypeScript 5+, Vite 6+, Tailwind CSS v4, Capacitor 6/7, Motion (Framer Motion)

---

## 🚀 Building the Project

### 1. Install Dependencies
```bash
npm ci
```

### 2. Verify TypeScript Types
```bash
npm run lint
```

### 3. Production Web Build
```bash
npm run build
```

### 4. Capacitor Android Synchronization
```bash
npx cap sync android
```

### 5. Build Android APKs (Debug & Release)
```bash
cd android
chmod +x gradlew
./gradlew assembleDebug assembleRelease --stacktrace
```

The compiled APKs will be located at:
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk` (`Master-Docs-debug.apk`)
- **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk` (`Master-Docs-release.apk`)

---

## 🔑 GitHub Actions & Release Signing

This repository includes an automated GitHub Actions workflow (`.github/workflows/android-build.yml`) that automatically builds the production web app, synchronizes Capacitor, and compiles the Android APKs on push to `main` or pull requests.

### Configuring Signed Releases
To sign the release APK automatically during GitHub Actions builds, set the following **GitHub Secrets** in your repository (`Settings > Secrets and variables > Actions`):

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded string of your `.jks` or `.keystore` file.
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password.
- `ANDROID_KEY_ALIAS`: Key alias name.
- `ANDROID_KEY_PASSWORD`: Key password.

*If signing secrets are not configured, the GitHub Actions workflow produces a functional unsigned release APK.*

---

## 📄 Application Identity & Package Information

- **Official App Name**: `MASTER DOCS`
- **Android Package ID**: `com.masterdocs.reader`
- **Version**: `1.0.0`
- **Target Platform**: Android API 34 (Android 14) / Min API 23 (Android 6.0)

---

## 📜 License
Apache-2.0 License. Built for offline document privacy.
