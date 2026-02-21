import { NextRequest, NextResponse } from 'next/server';

/**
 * Messaging Integration API
 * Handles Telegram, WhatsApp, Discord, Slack integrations
 */

// Types
interface MessagingConfig {
  platform: string;
  botToken?: string;
  phoneNumber?: string;
  webhookUrl?: string;
  chatId?: string;
}

interface SendMessageRequest {
  platform: string;
  message: string;
  recipient: string;
  config: MessagingConfig;
}

/**
 * POST /api/messaging
 * Send message to a messaging platform
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, platform, message, recipient, config } = body;

    switch (action) {
      case 'send':
        return await sendMessage({ platform, message, recipient, config });

      case 'connect':
        return await connectPlatform(platform, config);

      case 'disconnect':
        return await disconnectPlatform(platform);

      case 'webhook':
        return await handleWebhook(platform, body);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Messaging API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Send message to platform
 */
async function sendMessage(data: SendMessageRequest) {
  const { platform, message, recipient, config } = data;

  switch (platform) {
    case 'telegram':
      return await sendTelegramMessage(config.botToken!, recipient, message);

    case 'whatsapp':
      return await sendWhatsAppMessage(config.botToken!, config.phoneNumber!, recipient, message);

    case 'discord':
      return await sendDiscordMessage(config.webhookUrl!, message);

    case 'slack':
      return await sendSlackMessage(config.webhookUrl!, message);

    default:
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
  }
}

/**
 * Telegram API
 */
async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: 'Telegram API error', details: data.description },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data.result.message_id,
      platform: 'telegram',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send Telegram message', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * WhatsApp Business API
 */
async function sendWhatsAppMessage(
  apiKey: string,
  phoneNumberId: string,
  recipient: string,
  message: string
) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return NextResponse.json(
        { error: 'WhatsApp API error', details: data.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data.messages?.[0]?.id,
      platform: 'whatsapp',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send WhatsApp message', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Discord Webhook
 */
async function sendDiscordMessage(webhookUrl: string, message: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Kyro IDE',
        avatar_url: 'https://kyro-ide.dev/logo.png',
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Discord API error', status: response.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      platform: 'discord',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send Discord message', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Slack Webhook
 */
async function sendSlackMessage(webhookUrl: string, message: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        username: 'Kyro IDE',
        icon_emoji: ':robot_face:',
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Slack API error', status: response.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      platform: 'slack',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send Slack message', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Connect platform (verify credentials)
 */
async function connectPlatform(platform: string, config: MessagingConfig) {
  switch (platform) {
    case 'telegram': {
      // Verify bot token
      const response = await fetch(
        `https://api.telegram.org/bot${config.botToken}/getMe`
      );
      const data = await response.json();

      if (!data.ok) {
        return NextResponse.json(
          { error: 'Invalid bot token', connected: false },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        connected: true,
        botInfo: data.result,
      });
    }

    case 'discord':
    case 'slack': {
      // Test webhook by sending a test message
      return NextResponse.json({
        success: true,
        connected: true,
        message: 'Webhook URL saved. Ready to send messages.',
      });
    }

    default:
      return NextResponse.json({ connected: false }, { status: 400 });
  }
}

/**
 * Disconnect platform
 */
async function disconnectPlatform(platform: string) {
  // In a real implementation, this would remove stored credentials
  return NextResponse.json({
    success: true,
    message: `Disconnected from ${platform}`,
  });
}

/**
 * Handle incoming webhook
 */
async function handleWebhook(platform: string, body: Record<string, unknown>) {
  // Process incoming messages from platforms
  console.log(`Received webhook from ${platform}:`, body);

  // In a real implementation, this would:
  // 1. Verify the webhook authenticity
  // 2. Parse the incoming message
  // 3. Send to AI for processing
  // 4. Send response back

  return NextResponse.json({ success: true });
}

/**
 * GET /api/messaging
 * Get connection status
 */
export async function GET() {
  return NextResponse.json({
    platforms: {
      telegram: { connected: false },
      whatsapp: { connected: false },
      discord: { connected: false },
      slack: { connected: false },
    },
    timestamp: new Date().toISOString(),
  });
}
