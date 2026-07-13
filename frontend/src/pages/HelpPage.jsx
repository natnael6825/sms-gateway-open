import React, { useState } from 'react';

const APK_BUILD_URL = 'https://expo.dev/accounts/natnaelfikre/projects/sms-gateway/builds/47e2635c-ba6b-4f92-ab72-aeb35ddab681';
const INSTALL_VIDEO_URL = 'https://www.youtube.com/shorts/N90_Buk_6O0';
const INSTALL_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/N90_Buk_6O0';
const ADB_VIDEO_URL = 'https://www.youtube.com/watch?v=zfMkeni1z-Q';
const ADB_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/zfMkeni1z-Q';
const PLATFORM_TOOLS_URL = 'https://developer.android.com/tools/releases/platform-tools';

function CopyBlock({ children }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return <div className="copy-block"><code>{children}</code><button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>;
}

export default function HelpPage() {
  return <div className="docs-page">
    <header className="page-intro"><div><p className="eyebrow">Owner manual</p><h1>Connect your Android sender</h1><p>Install the app, approve SMS access, pair your phone, and send your first message.</p></div></header>
    <nav className="docs-toc"><a href="#install">Install APK</a><a href="#build">Build your own</a><a href="#permission">SMS permission</a><a href="#pair">Pair</a><a href="#test">Test</a><a href="#integrate">Integrate</a><a href="#limits">Android limits</a></nav>
    <article className="docs-body">
      <section id="install"><span className="doc-number">01</span><div><h2>Download and install the APK</h2><div className="install-video-block"><div className="install-video-frame"><iframe src={INSTALL_VIDEO_EMBED_URL} title="SMS Gateway Android installation walkthrough" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="install-video-caption"><div><span>Quick video guide</span><strong>Watch the Android installation walkthrough</strong></div><a href={INSTALL_VIDEO_URL} target="_blank" rel="noreferrer">Open on YouTube ↗</a></div></div><p>Download the current standalone Android build from Expo. It includes the JavaScript bundle and does not need Metro, USB, or a development computer after installation.</p><a className="doc-download" href={APK_BUILD_URL} target="_blank" rel="noreferrer">Open the compiled APK build on Expo →</a><ol className="doc-steps"><li>Open the Expo build page on the phone and download the APK.</li><li>Open the downloaded file and allow installation from this source if Android asks.</li><li>When Google Play Protect offers to scan the app, choose <strong>Scan app</strong> and let the scan finish.</li><li>Complete the installation and open <strong>SMS Gateway</strong>.</li></ol><aside>Only install builds from the official Expo project link above or compile the source yourself. Do not disable Play Protect.</aside></div></section>

      <section id="build"><span className="doc-number">02</span><div><h2>Build your own APK with Expo</h2><p>You can compile the same standalone APK in your own Expo account. Install Node.js 20 or newer and Git first, then open PowerShell or a terminal in the cloned repository.</p><p><strong>Windows PowerShell</strong></p><CopyBlock>{`cd mobile
npm install
npm install --global eas-cli
eas login
eas build --platform android --profile preview`}</CopyBlock><p><strong>macOS or Linux</strong></p><CopyBlock>{`cd mobile
npm install
npm install --global eas-cli
eas login
eas build --platform android --profile preview`}</CopyBlock><ol className="doc-steps"><li><code>eas login</code> opens authentication for your Expo account.</li><li>If asked to create or link an EAS project, follow the CLI prompt for your account.</li><li>Allow EAS to create and securely store an Android signing keystore.</li><li>Wait for the cloud build to finish, then download the APK from the build page.</li></ol><p>The `preview` profile creates an installable APK. A development build or `app-debug.apk` requires Metro and should not be shared.</p></div></section>

      <section id="permission"><span className="doc-number">03</span><div><h2>Allow SMS permission</h2><p>SignalDesk sends through the phone’s SIM, so Android must grant it SMS and notification access. Approve the normal permission prompts after opening the app.</p><h3>If “Allow” is blocked or Android says “App was denied access”</h3><p>Android treats SMS as a restricted permission for some sideloaded APKs. Enable restricted settings first:</p><ol className="doc-steps"><li>Close the warning and open <strong>Settings → Apps → SMS Gateway</strong>.</li><li>Open the three-dot menu or <strong>More options</strong>.</li><li>Select <strong>Allow restricted settings</strong> and confirm with the phone PIN or fingerprint.</li><li>Return to <strong>Permissions → SMS</strong> and select <strong>Allow</strong>.</li><li>Also allow notifications, then reopen the app.</li></ol><p>On an owner-controlled phone with USB debugging, ADB can be used if the manufacturer does not show the restricted-settings option:</p><CopyBlock>adb shell pm grant com.natnaelfikre.smsgateway android.permission.SEND_SMS
adb shell pm grant com.natnaelfikre.smsgateway android.permission.POST_NOTIFICATIONS</CopyBlock><aside>Each person who sideloads the APK may need to approve restricted settings. Menu names vary between Samsung, Pixel, Xiaomi, and other manufacturers.</aside></div></section>

      <section id="pair"><span className="doc-number">04</span><div><h2>Pair the phone</h2><p>Open <strong>Devices</strong> in this dashboard. Copy both values shown there:</p><ol className="doc-steps"><li>The backend URL</li><li>The seven-character pairing code</li></ol><p>Enter both values in the Android app. The backend URL must be publicly reachable from the phone, preferably over HTTPS—for example <code>https://sms.example.com</code>.</p><aside>Do not enter <code>localhost</code> or <code>127.0.0.1</code> on a physical phone. Those addresses point back to the phone, not your server.</aside><p>After pairing, keep the app installed and allow its foreground notification. The Devices page should show the phone as connected within about 15 seconds.</p></div></section>

      <section id="test"><span className="doc-number">05</span><div><h2>Send a dashboard test</h2><p>Wait until the phone appears as connected, then open <strong>Messages</strong>. Enter a destination in international format and send a short test.</p><ol className="doc-steps"><li><strong>Pending</strong> — waiting for the phone.</li><li><strong>Dispatched</strong> — claimed by the Android sender.</li><li><strong>Sent</strong> — Android accepted the SMS send request.</li><li><strong>Failed</strong> — check permission, SIM credit, signal, and carrier restrictions.</li></ol></div></section>

      <section id="integrate"><span className="doc-number">06</span><div><h2>Connect your project</h2><p>Open <strong>API access</strong>, create a named API key, and save its full value immediately. The page includes interactive request testers plus cURL, JavaScript, and Python examples.</p><p>Queue a message:</p><CopyBlock>POST https://your-public-backend.example/api/v1/sms/send</CopyBlock><p>A successful request returns a message UUID and <code>pending</code>. Save that UUID; HTTP 201 means the job was accepted, not that the phone sent it.</p><p>Check the same message:</p><CopyBlock>GET https://your-public-backend.example/api/v1/sms/MESSAGE_UUID</CopyBlock><p>Poll the status endpoint every 2–5 seconds while the status is <code>pending</code> or <code>dispatched</code>. Stop polling at <code>sent</code> or <code>failed</code>. Send the same <code>X-API-Key</code> header with both requests.</p><aside>Keep API keys in server-side environment variables—never expose one in browser JavaScript or a public mobile application. Checking status never requires sending the SMS again. Each poll counts as an authenticated Request for the key, but not as another Message or Sent result.</aside></div></section>

      <section id="limits"><span className="doc-number">07</span><div><h2>Connect ADB, test it, then adjust limits</h2><p>Use this walkthrough to connect the owner-controlled Android phone before changing any SMS settings.</p>
        <div className="adb-video-block">
          <div className="adb-video-frame"><iframe src={ADB_VIDEO_EMBED_URL} title="ADB connection and Android SMS settings video" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
          <div className="adb-video-caption"><div><span>Video walkthrough</span><strong>Connect the phone before running settings commands</strong></div><a href={ADB_VIDEO_URL} target="_blank" rel="noreferrer">Watch on YouTube ↗</a></div>
        </div>

        <div className="adb-runbook">
          <div className="adb-runbook-step"><span>01</span><div><h3>Prepare the phone</h3><p>Install the latest <a href={PLATFORM_TOOLS_URL} target="_blank" rel="noreferrer">Android SDK Platform Tools</a>. On the phone, enable <strong>Developer options</strong> and <strong>USB debugging</strong>, connect the USB cable, unlock the phone, and approve the computer’s RSA prompt.</p></div></div>

          <div className="adb-runbook-step"><span>02</span><div><h3>Connect and authorize</h3><p>Restart ADB and confirm that the phone is listed as <code>device</code>. If it says <code>unauthorized</code>, unlock the phone and approve the prompt, then run the last command again.</p><CopyBlock>{`adb kill-server
adb start-server
adb devices -l`}</CopyBlock><details className="adb-wireless"><summary>Connect wirelessly on Android 11 or newer</summary><p>Connect the computer and phone to the same Wi-Fi. Open <strong>Developer options → Wireless debugging → Pair device with pairing code</strong>, then substitute the addresses shown by Android. The pairing port and connection port can be different.</p><CopyBlock>{`adb pair PHONE_IP:PAIRING_PORT
adb connect PHONE_IP:CONNECTION_PORT
adb devices -l`}</CopyBlock></details></div></div>

          <div className="adb-runbook-step"><span>03</span><div><h3>Test the connection</h3><p>Read the phone model and run a harmless shell command. Continue only when both commands return normally.</p><CopyBlock>{`adb shell getprop ro.product.model
adb shell echo SignalDesk_ADB_OK`}</CopyBlock></div></div>

          <div className="adb-runbook-step"><span>04</span><div><h3>Read, change, and verify the settings</h3><p>First record the current values:</p><CopyBlock>{`adb shell settings get global sms_outgoing_check_max_count
adb shell settings get global sms_outgoing_check_interval_ms`}</CopyBlock><p>On Android versions that expose these settings, this example requests a maximum of 100 messages per 60-second check window:</p><CopyBlock>{`adb shell settings put global sms_outgoing_check_max_count 100
adb shell settings put global sms_outgoing_check_interval_ms 60000
adb shell settings get global sms_outgoing_check_max_count
adb shell settings get global sms_outgoing_check_interval_ms`}</CopyBlock><p>Restore Android’s defaults with:</p><CopyBlock>{`adb shell settings delete global sms_outgoing_check_max_count
adb shell settings delete global sms_outgoing_check_interval_ms`}</CopyBlock></div></div>
        </div>

        <aside>These settings do not override manufacturer or carrier safeguards and do not guarantee recipient delivery. Increase volume gradually, send only consent-based messages, and comply with local law.</aside>
      </div></section>
    </article>
  </div>;
}
