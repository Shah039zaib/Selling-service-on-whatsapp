'use client';

import { useEffect, useCallback } from 'react';
import { socketClient } from '@/lib/socket';

export function useSocket() {
  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketClient.on(event, callback);
    return () => socketClient.off(event, callback);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketClient.emit(event, data);
  }, []);

  return {
    on,
    emit,
    isConnected: socketClient.isConnected,
    subscribeToCustomer: socketClient.subscribeToCustomer.bind(socketClient),
    unsubscribeFromCustomer: socketClient.unsubscribeFromCustomer.bind(socketClient),
    subscribeToWhatsApp: socketClient.subscribeToWhatsApp.bind(socketClient),
    unsubscribeFromWhatsApp: socketClient.unsubscribeFromWhatsApp.bind(socketClient),
  };
}

export function useSocketEvent(event: string, callback: (data: any) => void) {
  useEffect(() => {
    socketClient.on(event, callback);
    return () => socketClient.off(event, callback);
  }, [event, callback]);
}

export function useWhatsAppEvents(accountId: string | null) {
  useEffect(() => {
    if (!accountId) return;

    socketClient.subscribeToWhatsApp(accountId);
    return () => socketClient.unsubscribeFromWhatsApp(accountId);
  }, [accountId]);
}

export function useCustomerEvents(customerId: string | null) {
  useEffect(() => {
    if (!customerId) return;

    socketClient.subscribeToCustomer(customerId);
    return () => socketClient.unsubscribeFromCustomer(customerId);
  }, [customerId]);
}
