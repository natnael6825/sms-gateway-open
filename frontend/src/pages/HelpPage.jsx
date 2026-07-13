import React, { useState } from 'react';

const APK_BUILD_URL = 'https://expo.dev/accounts/natnaelfikre/projects/sms-gateway/builds/47e2635c-ba6b-4f92-ab72-aeb35ddab681';
const INSTALL_VIDEO_URL = 'https://www.youtube.com/shorts/N90_Buk_6O0';
const INSTALL_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/N90_Buk_6O0';
const PLATFORM_TOOLS_URL = 'https://developer.android.com/tools/releases/platform-tools';
const SAMSUNG_AUTO_BLOCKER_URL = 'https://www.samsung.com/uk/support/mobile-devices/protect-your-galaxy-device-with-the-new-auto-blocker-feature/';
const WINDOWS_CMD_ADB_KEY_RESET = [
  'adb kill-server',
  'del "%USERPROFILE%\\.android\\adbkey"',
  'del "%USERPROFILE%\\.android\\adbkey.pub"',
  'adb start-server',
].join('\n');
const WINDOWS_POWERSHELL_ADB_KEY_RESET = [
  'adb kill-server',
  'Remove-Item "$env:USERPROFILE\\.android\\adbkey" -ErrorAction SilentlyContinue',
  'Remove-Item "$env:USERPROFILE\\.android\\adbkey.pub" -ErrorAction SilentlyContinue',
  'adb start-server',
].join('\n');
const UNIX_ADB_KEY_RESET = [
  'adb kill-server',
  'rm -f ~/.android/adbkey ~/.android/adbkey.pub',
  'adb start-server',
].join('\n');
const ADB_RESTART_COMMANDS = [
  'adb kill-server',
  'adb start-server',
  'adb devices -l',
].join('\n');
const SMS_LIMIT_READ_COMMANDS = [
  'adb shell settings get global sms_outgoing_check_max_count',
  'adb shell settings get global sms_outgoing_check_interval_ms',
].join('\n');
const SMS_LIMIT_SET_COMMANDS = [
  'adb shell settings put global sms_outgoing_check_max_count 1000',
  'adb shell settings put global sms_outgoing_check_interval_ms 60000',
  'adb shell settings get global sms_outgoing_check_max_count',
  'adb shell settings get global sms_outgoing_check_interval_ms',
].join('\n');
const SMS_LIMIT_RESTORE_COMMANDS = [
  'adb shell settings delete global sms_outgoing_check_max_count',
  'adb shell settings delete global sms_outgoing_check_interval_ms',
  'adb reboot',
].join('\n');

function CopyBlock({ children }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return <div className="copy-block"><code>{children}</code><button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>;
}

export default function HelpPage() {
  return <div className="docs-page">
    <header className="page-intro"><div><p className="eyebrow">Owner manual</p><h1>Connect your Android sender</h1><p>Install the app, approve SMS access, pair your phone, and send your first message.</p></div></header>
    <nav className="docs-toc"><a href="#install">Install APK</a><a href="#build">Build your own</a><a href="#permission">SMS permission</a><a href="#pair">Pair</a><a href="#test">Test</a><a href="#integrate">Integrate</a><a href="#limits">SMS limit</a></nav>
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

      <section id="permission"><span className="doc-number">03</span><div><h2>Allow SMS permission</h2><p>SignalDesk sends through the phone’s SIM, so Android must grant it SMS and notification access. Approve the normal permission prompts after opening the app.</p><h3>If “Allow” is blocked or Android says “App was denied access”</h3><p>Android treats SMS as a restricted permission for some sideloaded APKs. Enable restricted settings first:</p><ol className="doc-steps"><li>Close the warning and open <strong>Settings → Apps → SMS Gateway</strong>.</li><li>Open the three-dot menu or <strong>More options</strong>.</li><li>Select <strong>Allow restricted settings</strong> and confirm with the phone PIN or fingerprint.</li><li>Return to <strong>Permissions → SMS</strong> and select <strong>Allow</strong>.</li><li>Also allow notifications, then reopen the app.</li></ol><aside>Each person who sideloads the APK may need to approve restricted settings. Menu names vary between Samsung, Pixel, Xiaomi, and other manufacturers.</aside></div></section>

      <section id="pair"><span className="doc-number">04</span><div><h2>Pair the phone</h2><p>Open <strong>Devices</strong> in this dashboard. Copy both values shown there:</p><ol className="doc-steps"><li>The backend URL</li><li>The seven-character pairing code</li></ol><p>Enter both values in the Android app. The backend URL must be publicly reachable from the phone, preferably over HTTPS—for example <code>https://sms.example.com</code>.</p><aside>Do not enter <code>localhost</code> or <code>127.0.0.1</code> on a physical phone. Those addresses point back to the phone, not your server.</aside><p>After pairing, keep the app installed and allow its foreground notification. The Devices page should show the phone as connected within about 15 seconds.</p></div></section>

      <section id="test"><span className="doc-number">05</span><div><h2>Send a dashboard test</h2><p>Wait until the phone appears as connected, then open <strong>Messages</strong>. Enter a destination in international format and send a short test.</p><ol className="doc-steps"><li><strong>Pending</strong> — waiting for the phone.</li><li><strong>Dispatched</strong> — claimed by the Android sender.</li><li><strong>Sent</strong> — Android accepted the SMS send request.</li><li><strong>Failed</strong> — check permission, SIM credit, signal, and carrier restrictions.</li></ol></div></section>

      <section id="integrate"><span className="doc-number">06</span><div><h2>Connect your project</h2><p>Open <strong>API access</strong>, create a named API key, and save its full value immediately. The page includes interactive request testers plus cURL, JavaScript, and Python examples.</p><p>Queue a message:</p><CopyBlock>POST https://your-public-backend.example/api/v1/sms/send</CopyBlock><p>A successful request returns a message UUID and <code>pending</code>. Save that UUID; HTTP 201 means the job was accepted, not that the phone sent it.</p><p>Check the same message:</p><CopyBlock>GET https://your-public-backend.example/api/v1/sms/MESSAGE_UUID</CopyBlock><p>Poll the status endpoint every 2–5 seconds while the status is <code>pending</code> or <code>dispatched</code>. Stop polling at <code>sent</code> or <code>failed</code>. Send the same <code>X-API-Key</code> header with both requests.</p><aside>Keep API keys in server-side environment variables—never expose one in browser JavaScript or a public mobile application. Checking status never requires sending the SMS again. Each poll counts as an authenticated Request for the key, but not as another Message or Sent result.</aside></div></section>

      <section id="limits"><span className="doc-number">07</span><div><h2>Increase Android’s SMS limit with ADB</h2><p>ADB is used here only to change Android’s outgoing SMS threshold. It is not required for SignalDesk pairing, normal sending, or keeping the phone connected.</p>

        <div className="adb-runbook">
          <div className="adb-runbook-step">
            <span>01</span>
            <div>
              <h3>Connect the phone with ADB</h3>
              <p>Download and extract the official <a href={PLATFORM_TOOLS_URL} target="_blank" rel="noreferrer">Android SDK Platform Tools</a>, then follow these three actions in order.</p>

              <div className="adb-connect-flow">
                <section className="adb-connect-phase">
                  <span className="adb-connect-number">1</span>
                  <div>
                    <p className="adb-connect-label">Phone setup</p>
                    <h4>Enable USB debugging</h4>
                    <ol className="doc-steps adb-checklist">
                      <li>Open <strong>Settings → About phone</strong>. On Samsung, open <strong>Software information</strong>.</li>
                      <li>Tap <strong>Build number</strong> seven times to unlock Developer options.</li>
                      <li>Open <strong>Developer options</strong> and turn on <strong>USB debugging</strong>.</li>
                    </ol>
                  </div>
                </section>

                <section className="adb-connect-phase">
                  <span className="adb-connect-number">2</span>
                  <div>
                    <p className="adb-connect-label">Cable and permission</p>
                    <h4>Connect and authorize this computer</h4>
                    <ol className="doc-steps adb-checklist">
                      <li>Open a terminal inside the extracted <strong>platform-tools</strong> folder.</li>
                      <li>Connect the unlocked phone with a <strong>data-capable USB cable</strong> and select <strong>File transfer / Android Auto</strong>.</li>
                    </ol>
                    <p className="adb-command-label">On the computer — run this to show the authorization prompt</p>
                    <CopyBlock>adb devices -l</CopyBlock>
                    <div className="adb-phone-prompt" role="note" aria-label="USB debugging authorization">
                      <span>On the phone</span>
                      <div>
                        <strong>When “Allow USB debugging?” appears:</strong>
                        <ol>
                          <li>Check <strong>Always allow from this computer</strong>.</li>
                          <li><strong>Tap “Allow”</strong>.</li>
                        </ol>
                        <p>Only remember a computer you own or trust.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="adb-connect-phase">
                  <span className="adb-connect-number">3</span>
                  <div>
                    <p className="adb-connect-label">Computer check</p>
                    <h4>Confirm the phone is authorized</h4>
                    <p>After tapping Allow on the phone, run the same command one more time:</p>
                    <CopyBlock>adb devices -l</CopyBlock>
                    <div className="adb-ready-result">
                      <span>Success</span>
                      <div>
                        <code>SERIAL_NUMBER&nbsp;&nbsp;<strong>device</strong>&nbsp;&nbsp;product:… model:…</code>
                        <p>The important word is <strong>device</strong>. If you see <code>unauthorized</code> instead, use the common-problems section below.</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="adb-runbook-step">
            <span>02</span>
            <div>
              <h3>Increase and verify the SMS limit</h3>
              <p>Read the current values first. <code>null</code> means Android is using its built-in defaults and no custom value has been saved.</p>
              <CopyBlock>{SMS_LIMIT_READ_COMMANDS}</CopyBlock>
              <p>Set the Android-side threshold to 1,000 messages per 60-second check window, then read both values back:</p>
              <CopyBlock>{SMS_LIMIT_SET_COMMANDS}</CopyBlock>
              <div className="adb-ready-result">
                <span>Expected</span>
                <div>
                  <code>1000&nbsp;&nbsp;and&nbsp;&nbsp;60000</code>
                  <p>If both values match, restart the phone so the telephony service reloads them.</p>
                </div>
              </div>
              <CopyBlock>adb reboot</CopyBlock>
              <details className="adb-disclosure">
                <summary>Restore Android’s default SMS limit</summary>
                <p>Delete both custom values and restart the phone:</p>
                <CopyBlock>{SMS_LIMIT_RESTORE_COMMANDS}</CopyBlock>
              </details>
            </div>
          </div>

          <div className="adb-runbook-step adb-troubleshooting">
            <span>03</span>
            <div>
              <h3>Fix common connection problems</h3>
              <ul>
                <li><code>adb</code> is not recognized: open the terminal inside the extracted <strong>platform-tools</strong> folder, or use <code>.\adb.exe</code> on Windows and <code>./adb</code> on macOS or Linux.</li>
                <li><code>unauthorized</code>: keep the phone unlocked, revoke USB debugging authorizations, reconnect the cable, check <strong>Always allow from this computer</strong>, then tap <strong>Allow</strong>. Do not set <code>$ADB_VENDOR_KEYS</code> manually.</li>
                <li>Samsung does not show the authorization prompt: temporarily turn off <a href={SAMSUNG_AUTO_BLOCKER_URL} target="_blank" rel="noreferrer">Settings → Security and privacy → Auto Blocker</a>. Turn it back on after changing the SMS limit.</li>
                <li>No device is listed: use a data-capable cable, select File transfer mode, try another USB port, and install the phone manufacturer’s Windows USB driver.</li>
                <li><code>offline</code>: unplug the phone, restart ADB with the commands below, reconnect, and approve the phone prompt again.</li>
              </ul>
              <CopyBlock>{ADB_RESTART_COMMANDS}</CopyBlock>

              <details className="adb-disclosure adb-key-reset">
                <summary>Still unauthorized? Reset this computer’s ADB key</summary>
                <p>Use this only when revoking phone authorizations and reconnecting does not show the RSA confirmation dialog. It does not erase phone data, but every phone previously approved by this computer will ask for authorization again.</p>
                <p className="adb-shell-label">Windows Command Prompt</p>
                <CopyBlock>{WINDOWS_CMD_ADB_KEY_RESET}</CopyBlock>
                <p className="adb-shell-label">Windows PowerShell</p>
                <CopyBlock>{WINDOWS_POWERSHELL_ADB_KEY_RESET}</CopyBlock>
                <p className="adb-shell-label">macOS or Linux</p>
                <CopyBlock>{UNIX_ADB_KEY_RESET}</CopyBlock>
                <p className="adb-key-followup">After running the matching block, reconnect the unlocked phone, run <code>adb devices -l</code>, check <strong>Always allow from this computer</strong>, and tap <strong>Allow</strong>.</p>
              </details>
            </div>
          </div>
        </div>

        <aside>These settings do not override manufacturer or carrier safeguards and do not guarantee recipient delivery. Increase volume gradually, send only consent-based messages, and comply with local law.</aside>
      </div></section>
    </article>
  </div>;
}
