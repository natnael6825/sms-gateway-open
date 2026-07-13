import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function FailedMessagesList({ messages = [], onRetry }) {
  const displayMessages = messages.slice(0, 10);

  if (displayMessages.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Failed Messages</Text>
      {displayMessages.map((message) => (
        <View key={message.id} style={styles.item} testID={`failed-message-${message.id}`}>
          <Text style={styles.phone} testID={`failed-phone-${message.id}`}>
            {message.phone_number}
          </Text>
          <Text style={styles.text} testID={`failed-text-${message.id}`}>
            {message.message_text}
          </Text>
          <Button
            testID={`retry-button-${message.id}`}
            title="Retry"
            onPress={() => onRetry && onRetry(message.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  item: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fef2f2',
  },
  phone: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    color: '#374151',
    marginBottom: 8,
  },
});
