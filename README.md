<div align="center">
  <h1>📄 MASTER DOCS</h1>
  <p><b>All-in-One Offline Android Document Reader & Encrypted Vault</b></p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-green.svg" alt="Platform" />
    <img src="https://img.shields.io/badge/Target%20SDK-API%2034%20(Android%2014)-blue.svg" alt="Target SDK" />
    <img src="https://img.shields.io/badge/License-Apache%202.0-orange.svg" alt="License" />
    <img src="https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg" alt="Privacy" />
  </p>
</div>

**MASTER DOCS** is a production-grade, offline-first Android document reader featuring a distinctive retro tactile design language, a floating translucent liquid glass navigation dock, interactive Material color theme customization, and robust local document rendering.

---

## 📱 App Screenshots & Navigation Flow

The interface is structured around an intuitive 5-tab floating liquid glass dock:

<p align="center">
  <img src="./Screenshot_20261116-143629_MASTER%20DOCS.png" width="19%" alt="01. Home & Library Hub" />
  <img src="./Screenshot_20261116-143632_MASTER%20DOCS.png" width="19%" alt="02. Secure Encrypted Vault" />
  <img src="./Screenshot_20261116-143633_MASTER%20DOCS.png" width="19%" alt="03. Saved Documents & Favourites" />
  <img src="./Screenshot_20261116-143635_MASTER%20DOCS.png" width="19%" alt="04. Recent Reading History" />
  <img src="./Screenshot_20261116-143637_MASTER%20DOCS.png" width="19%" alt="05. Appearance, Themes & Settings" />
</p>

| 1. 🏠 Home & Library | 2. 🔒 Secure Vault | 3. ⭐ Saved Documents | 4. 🕒 Recent History | 5. 🎨 Appearance & Themes |
| :---: | :---: | :---: | :---: | :---: |
| <img src="./Screenshot_20261116-143629_MASTER%20DOCS.png" width="180" alt="Home & Library Hub"/> | <img src="./Screenshot_20261116-143632_MASTER%20DOCS.png" width="180" alt="Secure Encrypted Vault"/> | <img src="./Screenshot_20261116-143633_MASTER%20DOCS.png" width="180" alt="Saved Documents"/> | <img src="./Screenshot_20261116-143635_MASTER%20DOCS.png" width="180" alt="Recent Reading History"/> | <img src="./Screenshot_20261116-143637_MASTER%20DOCS.png" width="180" alt="Settings & Appearance"/> |
| **All Documents Hub**<br>Category breakdown (PDF, DOCX, XLSX, PPTX, TXT), storage scan & quick resume | **PIN / Password Vault**<br>Encrypted on-device vault hiding private files from search and history | **Saved / Favourites**<br>One-tap starred documents for quick access offline | **Recent Sessions**<br>Reading session history with automatic progress resumption | **Tactile Personalization**<br>Light / Dark Ink modes, interactive Material accent color picker |

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
