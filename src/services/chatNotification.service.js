// services/chatNotification.service.js

class ChatNotificationService {
    /**
     * Request permission for desktop notifications
     */
    static async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support desktop notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    }

    /**
     * Send a desktop notification for a new message
     */
    static sendMessageNotification(
        senderName: string,
        messageContent: string,
        channelName: string,
        senderAvatar?: string,
        channelId?: string,
        messageId?: string
    ) {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return null;
        }

        if (Notification.permission !== 'granted') {
            console.log('Notification permission not granted');
            return null;
        }

        try {
            // Truncate long messages
            const truncatedContent = messageContent.length > 100 
                ? messageContent.substring(0, 100) + '...' 
                : messageContent;

            const notification = new Notification(
                `💬 ${senderName} in #${channelName}`,
                {
                    body: truncatedContent || '📎 Sent an attachment',
                    icon: senderAvatar || '/images/default-avatar.png',
                    tag: `chat-${channelId || 'global'}`,
                    data: {
                        channelId: channelId,
                        messageId: messageId,
                        type: 'chat-message',
                    },
                    requireInteraction: false,
                    silent: false,
                }
            );

            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);

            // Handle click - focus window and optionally navigate
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // If we have channel info, you could navigate to it
                if (channelId && window.location) {
                    // You can dispatch a custom event to switch channels
                    window.dispatchEvent(new CustomEvent('focus-channel', {
                        detail: { channelId }
                    }));
                }
            };

            return notification;
        } catch (error) {
            console.error('Error sending notification:', error);
            return null;
        }
    }

    /**
     * Play a notification sound
     */
    static playNotificationSound() {
        try {
            // Use Web Audio API for a gentle ping sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880; // A5 note
            oscillator.type = 'sine';
            
            // Quick fade in/out
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            // Silently fail if audio is not supported
            console.log('Audio notification not supported');
        }
    }

    /**
     * Check if the page is visible (user is on the tab)
     */
    static isPageVisible() {
        return !document.hidden;
    }

    /**
     * Send notification only if page is not visible
     */
    static sendNotificationIfAway(
        senderName: string,
        messageContent: string,
        channelName: string,
        senderAvatar?: string,
        channelId?: string,
        messageId?: string
    ) {
        // Only send notification if user is not on the page
        if (!this.isPageVisible()) {
            this.sendMessageNotification(
                senderName,
                messageContent,
                channelName,
                senderAvatar,
                channelId,
                messageId
            );
            
            // Play sound only if page is not visible
            this.playNotificationSound();
            
            return true;
        }
        
        // If page is visible, you might want to show a toast instead
        return false;
    }
}

export default ChatNotificationService;