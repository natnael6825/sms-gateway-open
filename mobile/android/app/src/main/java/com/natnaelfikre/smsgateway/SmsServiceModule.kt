package com.natnaelfikre.smsgateway

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsServiceModule"

    @ReactMethod
    fun startService(apiBaseUrl: String, deviceToken: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SmsForegroundService::class.java).apply {
                action = SmsForegroundService.ACTION_START
                putExtra(SmsForegroundService.EXTRA_API_URL, apiBaseUrl)
                putExtra(SmsForegroundService.EXTRA_DEVICE_TOKEN, deviceToken)
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            // Stop directly instead of starting the service with a stop action.
            // Direct stopping also works when Android no longer allows a new
            // background-service start. The service also performs normal
            // foreground-notification cleanup from onDestroy.
            val intent = Intent(reactApplicationContext, SmsForegroundService::class.java)
            SmsForegroundService.disableNotificationUpdates()
            reactApplicationContext.stopService(intent)

            // Be defensive for OEMs that retain an ongoing notification after
            // stopping a foreground service.
            val notificationManager = reactApplicationContext.getSystemService(
                Context.NOTIFICATION_SERVICE
            ) as NotificationManager
            notificationManager.cancel(SmsForegroundService.NOTIFICATION_ID)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }
}
