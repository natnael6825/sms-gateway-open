'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');
const { DISPATCH_READY_WINDOW_MS } = require('../services/dispatchPolicy');

/**
 * POST /api/device/pair
 * Body: { code, device_identifier?, name?, model? }
 * Returns { token }
 */
async function pairDevice(req, res) {
  const { code, device_identifier, name = 'Unknown Device', model = 'Unknown' } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Device key is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { device_key: code.toUpperCase() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid device key' });
    }

    const deviceIdentifier = device_identifier || crypto.randomUUID();

    const device = await prisma.device.create({
      data: {
        user_id: user.id,
        device_identifier: deviceIdentifier,
        name,
        model,
        is_connected: true,
        last_seen: new Date(),
      },
    });

    const token = jwt.sign(
      { userId: user.id, deviceId: device.id },
      process.env.JWT_SECRET,
      { expiresIn: '1y' }
    );

    return res.status(200).json({ token });
  } catch (err) {
    console.error('pairDevice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/device/heartbeat
 * Device auth required. Updates last_seen and is_connected=true.
 */
async function heartbeat(req, res) {
  const { deviceId } = req.device;

  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: { last_seen: new Date(), is_connected: true },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('heartbeat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function disconnect(req, res) {
  const { deviceId } = req.device;
  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: { is_connected: false, last_seen: new Date() },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('disconnect error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateDeviceInfo(req, res) {
  const { deviceId } = req.device;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
  const model = typeof req.body?.model === 'string' ? req.body.model.trim().slice(0, 120) : '';
  if (!name || !model) return res.status(400).json({ error: 'Device name and model are required' });
  try {
    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { name, model, last_seen: new Date() },
      select: { id: true, name: true, model: true },
    });
    return res.status(200).json(device);
  } catch (error) {
    console.error('updateDeviceInfo error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/device/list
 * JWT auth required. Returns all active devices for the authenticated user.
 */
async function listDevices(req, res) {
  const userId = req.user.userId;

  try {
    // Mark devices as disconnected if not seen in last 60 seconds
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60_000);
    const readyCutoff = new Date(now.getTime() - DISPATCH_READY_WINDOW_MS);
    await prisma.device.updateMany({
      where: { user_id: userId, is_connected: true, last_seen: { lt: cutoff } },
      data: { is_connected: false },
    });

    const devices = await prisma.device.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { paired_at: 'desc' },
      select: {
        id: true,
        name: true,
        model: true,
        device_identifier: true,
        is_connected: true,
        last_seen: true,
        last_polled_at: true,
        messages_sent: true,
        paired_at: true,
      },
    });

    const stats = await prisma.message.groupBy({
      by: ['device_id', 'status'],
      where: { user_id: userId, device_id: { in: devices.map((device) => device.id) } },
      _count: { _all: true },
    });
    const enriched = devices.map((device) => ({
      ...device,
      dispatch_ready: Boolean(
        device.is_connected
        && device.last_seen >= cutoff
        && device.last_polled_at >= readyCutoff
      ),
      claimed_count: stats.filter((row) => row.device_id === device.id).reduce((sum, row) => sum + row._count._all, 0),
      sent_count: stats.find((row) => row.device_id === device.id && row.status === 'sent')?._count._all || 0,
      failed_count: stats.find((row) => row.device_id === device.id && row.status === 'failed')?._count._all || 0,
    }));

    return res.status(200).json(enriched);
  } catch (err) {
    console.error('listDevices error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/device/:id
 * Owner-authenticated operational detail for one paired Android sender.
 */
async function getDeviceDetails(req, res) {
  const userId = req.user.userId;
  const deviceId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(deviceId)) return res.status(400).json({ error: 'Invalid device id' });

  try {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, user_id: userId, is_active: true },
      select: {
        id: true, name: true, model: true, device_identifier: true,
        paired_at: true, last_seen: true, last_polled_at: true, is_active: true, is_connected: true,
      },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const [statusCounts, sentToday, recentMessages, chartMessages, latencyMessages] = await Promise.all([
      prisma.message.groupBy({
        by: ['status'], where: { user_id: userId, device_id: deviceId }, _count: { _all: true },
      }),
      prisma.message.count({
        where: { user_id: userId, device_id: deviceId, status: 'sent', delivered_at: { gte: today } },
      }),
      prisma.message.findMany({
        where: { user_id: userId, device_id: deviceId },
        orderBy: { created_at: 'desc' }, take: 100,
        select: {
          id: true, phone_number: true, message_text: true, status: true, source: true,
          created_at: true, dispatched_at: true, send_started_at: true, delivered_at: true,
        },
      }),
      prisma.message.findMany({
        where: { user_id: userId, device_id: deviceId, created_at: { gte: sevenDaysAgo } },
        select: { status: true, created_at: true },
      }),
      prisma.message.findMany({
        where: { user_id: userId, device_id: deviceId, delivered_at: { not: null } },
        orderBy: { delivered_at: 'desc' }, take: 200,
        select: { created_at: true, delivered_at: true },
      }),
    ]);

    const count = (status) => statusCounts.find((row) => row.status === status)?._count._all || 0;
    const sent = count('sent');
    const failed = count('failed');
    const assigned = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
    const finalized = sent + failed;
    const averageDeliveryMs = latencyMessages.length
      ? Math.round(latencyMessages.reduce((sum, message) => sum + (message.delivered_at - message.created_at), 0) / latencyMessages.length)
      : null;

    const dailyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setUTCDate(sevenDaysAgo.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const messages = chartMessages.filter((message) => message.created_at.toISOString().slice(0, 10) === key);
      return {
        date: key,
        sent: messages.filter((message) => message.status === 'sent').length,
        failed: messages.filter((message) => message.status === 'failed').length,
        assigned: messages.length,
      };
    });

    const connected = device.is_connected && device.last_seen && (now - device.last_seen) < 60_000;
    const dispatchReady = connected
      && device.last_polled_at
      && (now - device.last_polled_at) < DISPATCH_READY_WINDOW_MS;
    return res.status(200).json({
      device: { ...device, is_connected: Boolean(connected), dispatch_ready: Boolean(dispatchReady) },
      stats: {
        assigned, sent, failed, pending: count('pending'), dispatched: count('dispatched'),
        sent_today: sentToday,
        success_rate: finalized ? Math.round((sent / finalized) * 1000) / 10 : null,
        average_delivery_ms: averageDeliveryMs,
      },
      daily_activity: dailyActivity,
      messages: recentMessages,
    });
  } catch (error) {
    console.error('getDeviceDetails error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/device/:id
 * JWT auth required. Soft-deletes a device belonging to the user.
 */
async function removeDevice(req, res) {
  const userId = req.user.userId;
  const deviceId = parseInt(req.params.id);

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    if (!device || device.user_id !== userId) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { is_active: false, is_connected: false },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('removeDevice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/device/activity
 * Device-authenticated activity used by the Android UI. Native background
 * sends are sourced from the backend so counters survive restarts/reinstalls.
 */
async function getActivity(req, res) {
  const userId = req.device.userId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const [sentToday, history] = await Promise.all([
      prisma.message.count({ where: { user_id: userId, status: 'sent', delivered_at: { gte: today } } }),
      prisma.message.findMany({
        where: { user_id: userId, status: { in: ['sent', 'failed'] } },
        orderBy: { delivered_at: 'desc' },
        take: 100,
        select: { id: true, phone_number: true, message_text: true, status: true, delivered_at: true },
      }),
    ]);
    return res.status(200).json({
      sent_today: sentToday,
      last_sent: history.find((message) => message.status === 'sent') || null,
      history,
    });
  } catch (error) {
    console.error('getActivity error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { pairDevice, heartbeat, disconnect, updateDeviceInfo, listDevices, getDeviceDetails, removeDevice, getActivity };
