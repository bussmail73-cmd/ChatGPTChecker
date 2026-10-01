# ChatGPT Checker — Otid Edition 🚀
### Professional Account & Subscription Management for ChatGPT

A high-performance, standalone Windows desktop application designed for bulk managing, plan checking, 2FA rotation, and session management for ChatGPT personal, team, and enterprise accounts.

![ChatGPT Checker Interface](screenshot.png)

---

## 🌟 Key Features

| Tool | Description |
| :--- | :--- |
| **🔍 Check Plan** | Reads subscription plans (**Free, Plus, Pro, Go, Team, Business, Enterprise, Edu, K12**), quota usage percentages, reset times, and workspace entitlements across personal and organization workspaces. |
| **🚪 Logout All Sessions** | Terminate all active browser sessions, mobile app tokens, and API credentials across all devices in a single click. |
| **🔐 Change 2FA (Personal)** | Automatically rotate TOTP 2FA secret keys for personal ChatGPT accounts while retaining existing passwords. |
| **🏢 Change 2FA (Team / K12)** | Account-wide 2FA rotation for Team, Business, Enterprise, Edu, and K12 multi-workspace accounts. |
| **🔑 Get Access Token** | Retrieve fresh ChatGPT OAuth Bearer access tokens (`chatgpt.com/api/auth/session`) for downstream automation. |
| **⏱️ Get 2FA (TOTP Generator)** | Bulk generate real-time 6-digit 2FA OTP codes from credentials (`email\|pass\|secret`) or standalone Base32 secret keys. |
| **🛡️ Proxy & Stealth Support** | Full HTTP / SOCKS5 proxy rotation support with TLS fingerprint impersonation to bypass Cloudflare and rate limits. |
| **📊 30-Day Audit Logs** | Comprehensive daily audit trail with real-time streaming, filtering, and 1-click TXT exports. |

---

## 📥 Installation & Setup Methods

All dependencies and runtimes are pre-packaged. **No Node.js or Python installation is required.** Choose either method below:

### Method 1: Automatic 1-Click Setup (`Setup.exe`) — Recommended
1. Download **`Setup.exe`** from the **[Latest Release](https://github.com/bussmail73-cmd/ChatGPTChecker/releases/latest)**.
2. Run `Setup.exe`.
3. The wizard installs the application to your local user directory and creates a **Desktop Shortcut**.
4. Launch **ChatGPT Checker** from your desktop or Start Menu.

### Method 2: Manual / Portable Setup (`bundle.zip`)
1. Download **`bundle.zip`** from the **[Latest Release](https://github.com/bussmail73-cmd/ChatGPTChecker/releases/latest)**.
2. Extract `bundle.zip` into any folder of your choice (e.g. `C:\ChatGPTChecker` or a USB drive).
3. Start the application:
   - Double-click **`Launch-App.vbs`** to run silently in the background and open your default browser.
   - Alternatively, double-click **`Start-App.bat`** to run with a visible console window.
4. To stop the application, run **`Stop-App.bat`**.

---

## 🔄 Live Automatic In-App Updates

ChatGPT Checker includes an integrated **1-Click Live Update System**:
* When a newer version is released on GitHub, a notification badge lights up in the application header: `🔔 New update available!`.
* Click **Update Now** inside the app — it automatically downloads the release archive, verifies the SHA-256 integrity, replaces program files, and restarts smoothly without losing your settings or audit logs.
* You can also manually check for updates at any time by navigating to **Settings ⚙️** and clicking **Check Update**.

---

## 📞 Buy ChatGPT Accounts & Official Support

Looking to buy bulk ChatGPT accounts, subscription licenses, or need technical assistance?

* **Brand / Support:** **Otid**
* **Telegram:** [@VoriFY_Support](https://t.me/VoriFY_Support)

---

*ChatGPT Checker — Fast, Secure, and Automated.*
