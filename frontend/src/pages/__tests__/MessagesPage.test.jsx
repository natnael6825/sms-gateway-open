import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDevices, getMessages, sendMessage } from '../../api/client';
import MessagesPage, { getPaginationItems } from '../MessagesPage';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getDevices: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  };
});

function makeMessage(id, status = 'sent') {
  return {
    id,
    phone_number: `+251900000${String(id).padStart(3, '0')}`,
    message_text: `Message ${id}`,
    status,
    created_at: '2026-07-13T09:00:00.000Z',
    dispatched_at: '2026-07-13T09:00:01.000Z',
    send_started_at: '2026-07-13T09:00:02.000Z',
    delivered_at: '2026-07-13T09:00:03.000Z',
    device: { id: 4, name: 'Gateway phone', model: 'SM-A356E' },
  };
}

function paginatedResponse({ page = 1, pageSize = 10, total = 25, status = 'all' } = {}) {
  const firstId = (page - 1) * pageSize + 1;
  const count = Math.max(0, Math.min(pageSize, total - firstId + 1));
  const totalPages = Math.ceil(total / pageSize);
  return {
    messages: Array.from({ length: count }, (_, index) => (
      makeMessage(firstId + index, status === 'all' ? 'sent' : status)
    )),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_previous: page > 1,
      has_next: page < totalPages,
    },
  };
}

function renderPage() {
  return render(<MemoryRouter><MessagesPage /></MemoryRouter>);
}

describe('MessagesPage pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDevices.mockResolvedValue([{ id: 4, is_connected: true, dispatch_ready: true, is_active: true }]);
    sendMessage.mockResolvedValue({ id: 99 });
    getMessages.mockImplementation(async ({ page, pageSize, status }) => (
      paginatedResponse({
        page,
        pageSize,
        status,
        total: status === 'failed' ? 3 : 25,
      })
    ));
  });

  it('requests the first server page and moves next with an accurate visible range', async () => {
    renderPage();

    await waitFor(() => expect(getMessages).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      status: 'all',
    }));
    expect(await screen.findByText('1–10')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(getMessages).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 10,
      status: 'all',
    }));
    expect(await screen.findByText('11–20')).toBeInTheDocument();
  });

  it('resets to page one when the status filter changes', async () => {
    renderPage();
    await screen.findByText('1–10');

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(getMessages).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(getMessages).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      status: 'failed',
    }));
    expect(await screen.findByText('1–3')).toBeInTheDocument();
  });

  it('changes the page size and returns to the first page', async () => {
    renderPage();
    await screen.findByText('1–10');

    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });

    await waitFor(() => expect(getMessages).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 25,
      status: 'all',
    }));
    expect(await screen.findByText('1–25')).toBeInTheDocument();
  });

  it('normalizes a legacy array response and renders an empty filtered state', async () => {
    getMessages.mockResolvedValueOnce([makeMessage(1, 'sent'), makeMessage(2, 'failed')]);
    renderPage();

    expect(await screen.findByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('1–2')).toBeInTheDocument();

    getMessages.mockResolvedValue(paginatedResponse({ total: 0, status: 'pending' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(await screen.findByText('No messages found')).toBeInTheDocument();
    expect(screen.getByText('0–0')).toBeInTheDocument();
  });

  it('uses compact page items with ellipses for long histories', () => {
    expect(getPaginationItems(10, 20)).toEqual([1, 'ellipsis-1', 9, 10, 11, 'ellipsis-11', 20]);
  });

  it('keeps sending locked when a phone is reachable but its sender is not polling', async () => {
    getDevices.mockResolvedValue([{ id: 4, is_connected: true, dispatch_ready: false, is_active: true }]);
    renderPage();

    expect(await screen.findByText('Connect an Android sender to send')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send Message' })).not.toBeInTheDocument();
  });
});
