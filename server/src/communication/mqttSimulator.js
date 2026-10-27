import EventEmitter from 'events';

class MqttSimulator extends EventEmitter {
  constructor() {
    super();
    this.status = 'SIMULATED MQTT — NO EXTERNAL BROKER CONNECTED';
    this.brokerUrl = 'mqtt://simulated-broker.internal:1883';
    this.recentPackets = [];
    this.maxPackets = 150;
    this.subscriptions = new Map(); // topic pattern -> Set of callbacks
  }

  publish(topic, payload, { qos = 1, retain = false, direction = 'INBOUND', commandId = null, messageType = 'TELEMETRY' } = {}) {
    const timestamp = new Date().toISOString();
    const packet = {
      id: `PKT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      topic,
      payload,
      qos,
      retain,
      direction, // 'INBOUND' (device -> broker/backend) or 'OUTBOUND' (backend -> device)
      commandId,
      messageType, // 'TELEMETRY' | 'COMMAND' | 'ACK' | 'HEARTBEAT' | 'EVENT'
      timestamp
    };

    this.recentPackets.unshift(packet);
    if (this.recentPackets.length > this.maxPackets) {
      this.recentPackets.pop();
    }

    // Trigger local listeners
    this.emit('message', packet);

    // Call any matching subscribed handlers
    for (const [subPattern, handlers] of this.subscriptions.entries()) {
      if (this.matchTopic(subPattern, topic)) {
        for (const handler of handlers) {
          try {
            handler(topic, payload, packet);
          } catch (e) {
            console.error(`MQTT handler error on ${topic}:`, e);
          }
        }
      }
    }

    return packet;
  }

  subscribe(topicPattern, handler) {
    if (!this.subscriptions.has(topicPattern)) {
      this.subscriptions.set(topicPattern, new Set());
    }
    this.subscriptions.get(topicPattern).add(handler);
  }

  unsubscribe(topicPattern, handler) {
    if (this.subscriptions.has(topicPattern)) {
      this.subscriptions.get(topicPattern).delete(handler);
    }
  }

  matchTopic(pattern, topic) {
    if (pattern === '#' || pattern === topic) return true;
    const patParts = pattern.split('/');
    const topParts = topic.split('/');
    for (let i = 0; i < patParts.length; i++) {
      if (patParts[i] === '#') return true;
      if (patParts[i] === '+') continue;
      if (patParts[i] !== topParts[i]) return false;
    }
    return patParts.length === topParts.length;
  }

  getRecentPackets(limit = 50) {
    return this.recentPackets.slice(0, limit);
  }
}

export const mqttSimulator = new MqttSimulator();
