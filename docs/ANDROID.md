# Android setup and SMS limit

## Install the compiled APK

Open the [official SignalDesk EAS build](https://expo.dev/accounts/natnaelfikre/projects/sms-gateway/builds/47e2635c-ba6b-4f92-ab72-aeb35ddab681) on the Android phone and download the APK. Allow installation from the browser or file manager when Android asks. If Google Play Protect offers to scan the APK, choose **Scan app**, wait for it to finish, and then complete installation. Do not disable Play Protect.

The shared APK is standalone and does not require Metro. After installation, follow the restricted-permission instructions below if Android blocks SMS access.

## Install a development APK

1. Install Android Studio, including Android SDK Platform Tools, or install the standalone platform tools.
2. On the phone, enable **Developer options** by tapping **Build number** seven times.
3. Enable **USB debugging**, connect by USB, and approve the computer prompt.
4. Verify the connection with `adb devices`. The device should show as `device`, not `unauthorized`.
5. From `mobile`, run `npm install` and `npm run android`.

This app contains native Kotlin SMS modules and cannot send silently from Expo Go. Use an EAS development/production build or `expo run:android`.

For an EAS APK, install EAS CLI, authenticate, and run `eas build --platform android --profile preview`. Install the resulting APK, grant SMS and notification permissions, and exclude the app from aggressive battery optimization when the manufacturer provides that option.

## Pair with any backend

Open the app, enter the complete backend URL (for example `https://sms.example.com`) and the seven-character code from **Dashboard → Devices**. The app validates and stores the URL locally. Unpairing clears both the device token and URL.

For LAN development, use the computer's LAN address such as `http://192.168.1.20:6700`; `localhost` points to the phone. Ensure the firewall permits the port. Cleartext HTTP should only be used on a trusted development network.

## Fix “App was denied access” for SMS permission

Recent Android versions may classify SMS as a restricted permission when SignalDesk is installed from a downloaded or directly shared APK. The SMS permission screen can then disable **Allow** and display **App was denied access**. This is an Android sideloading protection, not a backend or pairing error.

On the phone:

1. Close the warning.
2. Open **Settings → Apps → SMS Gateway**.
3. Open the three-dot menu in the top-right.
4. Select **Allow restricted settings** and confirm with the device PIN or fingerprint.
5. Return to **Permissions → SMS** and select **Allow**.
6. Reopen SignalDesk.

On Samsung devices the option is commonly under **Settings → Apps → SMS Gateway → More options → Allow restricted settings**. Menu wording varies by manufacturer and Android version.

Every person who sideloads the APK may need to enable restricted settings on their own phone. Google Play distribution is different: apps requesting SMS permissions are subject to Google Play's restricted-permission policy and may require approval or eligibility as a permitted core use case.

## Diagnose sending

- Confirm the phone can send a normal SMS with its default messaging app.
- Confirm `GET /health` and the dashboard work from the phone's browser.
- Check SMS permission, SIM selection, credit, carrier rules, and battery optimization.

Android and carriers can throttle or block high-volume SMS. SignalDesk cannot disable platform or carrier safeguards. Increase sending volume gradually and test only legitimate, consent-based traffic.

## Increase Android's SMS limit with ADB

For owner setup, ADB is used only to change Android's outgoing SMS threshold. It is not required for SignalDesk pairing, normal sending, or keeping the phone connected.

### 1. Connect over USB

Install the latest [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools). Enable **Developer options** and **USB debugging**, connect the unlocked phone with a data-capable USB cable, select **File transfer / Android Auto**, and run:

```bash
adb devices -l
```

When **Allow USB debugging?** appears on the phone, check **Always allow from this computer**, then tap **Allow**. Run `adb devices -l` again; the phone must appear with the state `device`.

### 2. Increase and verify the limit

Read the current values first. `null` means Android is using its built-in defaults:

```bash
adb shell settings get global sms_outgoing_check_max_count
adb shell settings get global sms_outgoing_check_interval_ms
```

Then set the Android-side threshold to 1,000 messages per 60-second check window and read both values back:

```bash
adb shell settings put global sms_outgoing_check_max_count 1000
adb shell settings put global sms_outgoing_check_interval_ms 60000
adb shell settings get global sms_outgoing_check_max_count
adb shell settings get global sms_outgoing_check_interval_ms
```

After both verification commands return the new values, restart the phone so the telephony service reloads them:

```bash
adb reboot
```

OEM firmware may ignore these settings, and carriers can enforce separate limits. Restore Android defaults with:

```bash
adb shell settings delete global sms_outgoing_check_max_count
adb shell settings delete global sms_outgoing_check_interval_ms
```

### 3. Fix common connection problems

- `adb` is not recognized: open the terminal inside the extracted `platform-tools` folder, or use `.\adb.exe` on Windows and `./adb` on macOS or Linux.
- `unauthorized`: keep the phone unlocked, revoke USB debugging authorizations, reconnect, check **Always allow from this computer**, and tap **Allow**. Do not set `$ADB_VENDOR_KEYS` manually.
- Samsung does not show the prompt: temporarily turn off **Settings → Security and privacy → Auto Blocker**, then turn it back on after changing the limit.
- No device is listed: use a data-capable cable, select File transfer mode, try another USB port, and install the manufacturer's Windows USB driver.
- `offline`: unplug the phone, restart ADB, reconnect, and approve the prompt again.

```bash
adb kill-server
adb start-server
adb devices -l
```

Do not use these controls to evade platform, carrier, consent, or legal safeguards.
