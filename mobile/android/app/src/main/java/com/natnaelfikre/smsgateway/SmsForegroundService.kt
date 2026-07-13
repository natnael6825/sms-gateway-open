package com.natnaelfikre.smsgateway

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.UUID

class SmsForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        const val CHANNEL_ID = "sms_gateway_fg"
        const val NOTIFICATION_ID = 42
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val EXTRA_API_URL = "apiBaseUrl"
        const val EXTRA_DEVICE_TOKEN = "deviceToken"
        private const val POLL_MS = 5_000L
        private const val RECONNECT_MS = 10_000L
        private const val SMS_CONFIRM_TIMEOUT_SEC = 30L
    }

    private var apiBaseUrl = ""
    private var deviceToken = ""
    private var loopJob: Job? = null
    private val reportPrefs by lazy { getSharedPreferences("delivery_report_outbox", Context.MODE_PRIVATE) }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                apiBaseUrl = intent.getStringExtra(EXTRA_API_URL) ?: ""
                deviceToken = intent.getStringExtra(EXTRA_DEVICE_TOKEN) ?: ""
                startForeground(NOTIFICATION_ID, buildNotification("Monitoring for messages…"))
                startLoop()
            }
        }
        return START_STICKY
    }

    private fun startLoop() {
        loopJob?.cancel()
        loopJob = serviceScope.launch {
            var consecutiveErrors = 0
            while (isActive) {
                val ok = runCatching { pollAndSend() }.isSuccess
                if (ok) {
                    consecutiveErrors = 0
                    delay(POLL_MS)
                } else {
                    consecutiveErrors++
                    val backoff = minOf(RECONNECT_MS * consecutiveErrors, 60_000L)
                    android.util.Log.w("SmsFgService", "error #$consecutiveErrors — retrying in ${backoff}ms")
                    updateNotification("Reconnecting… (attempt $consecutiveErrors)")
                    delay(backoff)
                }
            }
        }
    }

    private fun pollAndSend() {
        if (deviceToken.isNotEmpty()) runCatching { sendHeartbeat() }

        if (!flushDeliveryReports()) {
            throw RuntimeException("delivery report outbox is waiting for network")
        }

        val conn = openConn("$apiBaseUrl/api/messages/pending", "GET")
        if (conn.responseCode != 200) throw RuntimeException("poll HTTP ${conn.responseCode}")

        val body = conn.inputStream.bufferedReader().readText().trim()
        if (body == "null" || body.isEmpty()) {
            updateNotification("Monitoring for messages…")
            return
        }

        val message = JSONObject(body)
        val id = message.getInt("id")
        val phone = message.getString("phone_number")
        val text = message.getString("message_text")

        android.util.Log.d("SmsFgService", "dispatching message $id → $phone")

        reportSendStarted(id)
        val status = if (sendSmsWithConfirmation(id, phone, text)) "sent" else "failed"
        android.util.Log.d("SmsFgService", "message $id status: $status")

        enqueueDeliveryReport(id, status)
        flushDeliveryReports()
        updateNotification(if (status == "sent") "✓ Sent to $phone" else "✗ Failed → $phone")
    }

    /**
     * Sends SMS using a PendingIntent so we get the real result from the SMS framework
     * (carrier acceptance/rejection), not just whether the API call didn't throw.
     * Waits up to 30 seconds for confirmation.
     */
    private fun sendSmsWithConfirmation(messageId: Int, phone: String, text: String): Boolean {
        val sentAction = "$packageName.SMS_SENT.${UUID.randomUUID()}"
        val callbackIntent = Intent(sentAction).setPackage(packageName)
        val sentPI = PendingIntent.getBroadcast(
            this, messageId, callbackIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val latch = CountDownLatch(1)
        var callbackResult: Int? = null

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                callbackResult = resultCode
                android.util.Log.d("SmsFgService", "SMS callback for $messageId: result=$resultCode")
                latch.countDown()
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // The telephony service delivers the PendingIntent callback from a
            // system process, so OEMs may block it when registered NOT_EXPORTED.
            registerReceiver(receiver, IntentFilter(sentAction), RECEIVER_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(receiver, IntentFilter(sentAction))
        }

        try {
            val smsManager = getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
            smsManager.sendTextMessage(phone, null, text, sentPI, null)
            val callbackReceived = latch.await(SMS_CONFIRM_TIMEOUT_SEC, TimeUnit.SECONDS)
            if (!callbackReceived) {
                // sendTextMessage accepted the request and did not throw. Some
                // OEM telephony stacks never return the sent PendingIntent, so
                // a timeout is an unknown callback—not evidence of failure.
                android.util.Log.w("SmsFgService", "SMS callback timed out for $messageId; treating submission as sent")
                return true
            }
            return callbackResult == Activity.RESULT_OK
        } catch (e: Exception) {
            android.util.Log.e("SmsFgService", "sendTextMessage threw: ${e.message}")
            return false
        } finally {
            runCatching { unregisterReceiver(receiver) }
        }
    }

    private fun sendHeartbeat() {
        val conn = openConn("$apiBaseUrl/api/device/heartbeat", "POST")
        conn.doOutput = true
        OutputStreamWriter(conn.outputStream).use { it.write("{}") }
        conn.responseCode
    }

    private fun reportSendStarted(id: Int) {
        val conn = openConn("$apiBaseUrl/api/messages/$id/send-started", "POST")
        conn.doOutput = true
        OutputStreamWriter(conn.outputStream).use { it.write("{}") }
        val code = conn.responseCode
        if (code !in 200..299) throw RuntimeException("send-started HTTP $code")
    }

    private fun enqueueDeliveryReport(id: Int, status: String) {
        reportPrefs.edit().putString(id.toString(), status).apply()
    }

    private fun flushDeliveryReports(): Boolean {
        for ((key, value) in reportPrefs.all) {
            val id = key.toIntOrNull() ?: continue
            val status = value as? String ?: continue
            if (!reportStatus(id, status)) return false
            reportPrefs.edit().remove(key).apply()
        }
        return true
    }

    private fun reportStatus(id: Int, status: String): Boolean {
        return try {
            val conn = openConn("$apiBaseUrl/api/webhook/$id", "POST")
            conn.doOutput = true
            OutputStreamWriter(conn.outputStream).use { it.write("{\"status\":\"$status\"}") }
            val code = conn.responseCode
            android.util.Log.d("SmsFgService", "delivery report $id: HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            android.util.Log.e("SmsFgService", "webhook failed: ${e.message}")
            false
        }
    }

    private fun openConn(url: String, method: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty("Content-Type", "application/json")
        if (deviceToken.isNotEmpty()) conn.setRequestProperty("X-Device-Token", deviceToken)
        conn.connectTimeout = 8_000
        conn.readTimeout = 8_000
        return conn
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "SMS Gateway", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps SMS Gateway running in the background"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification =
        Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("SMS Gateway")
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        loopJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }
}
