package com.natnaelfikre.smsgateway

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.telephony.SmsManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class SmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        val ctx = reactApplicationContext
        val sentAction = "SMS_SENT_${System.currentTimeMillis()}"
        val sentPI = PendingIntent.getBroadcast(
            ctx, 0, Intent(sentAction),
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val latch = CountDownLatch(1)
        var success = false

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                success = resultCode == Activity.RESULT_OK
                latch.countDown()
            }
        }

        ctx.registerReceiver(receiver, IntentFilter(sentAction), Context.RECEIVER_NOT_EXPORTED)

        try {
            val smsManager = ctx.getSystemService(SmsManager::class.java)
                ?: SmsManager.getDefault()
            smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null)
            latch.await(30, TimeUnit.SECONDS)

            if (success) {
                promise.resolve("sent")
            } else {
                promise.reject("SMS_FAILED", "Carrier rejected the message")
            }
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message, e)
        } finally {
            runCatching { ctx.unregisterReceiver(receiver) }
        }
    }
}
