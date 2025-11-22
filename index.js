const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Get tokens from environment variables
const NETCORE_API_KEY = process.env.WHATSAPP_TOKEN; // Your Bearer token
const NETCORE_SOURCE = process.env.PHONE_NUMBER_ID; // Your source ID

// Trigger keyword
const TRIGGER_KEYWORD = '7358433457';

// Test endpoint for server check
app.get('/', (req, res) => {
  res.send('✅ Webhook server is running!');
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  console.log('\n📨 WEBHOOK RECEIVED');
  console.log('📦 FULL BODY:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'received' });

  try {
    const body = req.body;
    let userPhone = null;
    let messageText = null;

    // Check for Netcore format (incoming_message array)
    if (body.incoming_message && body.incoming_message[0]) {
      const message = body.incoming_message[0];
      userPhone = message.from;

      // Extract text from text_type object
      if (message.text_type && message.text_type.text) {
        messageText = message.text_type.text;
      }
    }
    // Fallback to simple format (for testing)
    else if (body.from && body.text) {
      userPhone = body.from;
      messageText = body.text;
    }

    console.log(`📞 Extracted Phone: ${userPhone}`);
    console.log(`💬 Extracted Text: ${messageText}`);

    if (!userPhone || !messageText) {
      console.log('⏭️  No phone/text found, skipping');
      return;
    }

    console.log(`📞 From: ${userPhone}`);
    console.log(`💬 Message: "${messageText}"`);

    if (messageText.includes(TRIGGER_KEYWORD)) {
      console.log(`✅ KEYWORD MATCHED! Sending 3 messages...`);

      if (!NETCORE_API_KEY || !NETCORE_SOURCE) {
        console.log('⚠️  Tokens not configured in Secrets');
        return;
      }

      await sendThreeMessages(userPhone);
    } else {
      console.log(`⏭️  Keyword not found. Received: "${messageText}"`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
});

// 3 messages with delay, 3rd message is CTA button
async function sendThreeMessages(userPhone) {
  try {
    // Message 1
    console.log('📤 Message 1/3...');
    await sendNetcoreMessage(
      userPhone,
      '✨ Your stars are aligning in a powerful way today...'
    );

    await sleep(2000);

    // Message 2
    console.log('📤 Message 2/3...');
    await sendNetcoreMessage(
      userPhone,
      '🔮 Our astrologer discovered something fascinating about your birth chart...'
    );

    await sleep(2000);

    // Message 3 = CTA
    console.log('📤 Message 3/3 (CTA)...');
    await sendNetcoreCTAMessage(
      userPhone,
      "https://yourbrand.com/offer", // <-- your CTA URL
      "Enjoy 20% off on your first order. Click the button below to shop now!",
      "Shop Now"
    );

    console.log('✅ All 3 messages sent!\n');
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Send WhatsApp text message via Netcore
async function sendNetcoreMessage(to, text) {
  const response = await axios.post(
    'https://cpaaswa.netcorecloud.net/api/v2/message/nc/message/',
    {
      message: [
        {
          recipient_whatsapp: to,
          recipient_type: 'individual',
          message_type: 'text',
          source: NETCORE_SOURCE,
          'x-apiheader': 'astro_automation',
          type_text: [
            {
              preview_url: 'false',
              content: text
            }
          ]
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${NETCORE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log(`   ✓ Sent successfully`);
  console.log(`   Response:`, JSON.stringify(response.data, null, 2));
  return response.data;
}

// Send WhatsApp CTA button message via Netcore
async function sendNetcoreCTAMessage(to, ctaUrl, bodyText, buttonText) {
  try {
    const response = await axios.post(
      'https://cpaaswa.netcorecloud.net/api/v2/message/nc/message/',
      {
        message: [
          {
            cta_link_track: "1",
            recipient_whatsapp: to,
            message_type: "interactive",
            recipient_type: "individual",
            source: NETCORE_SOURCE,
            "x-apiheader": "promo_tracking_code",
            type_interactive: [
              {
                type: "cta_url",
                header: {
                  type: "text",
                  url: ctaUrl
                },
                body: bodyText,
                action: [
                  {
                    buttons: [
                      {
                        name: "shop_now",
                        parameters: {
                          display_text: buttonText,
                          url: ctaUrl
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${NETCORE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ✓ CTA sent successfully');
    console.log('   CTA Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ CTA send error:', error.message);
    if (error.response) {
      console.error('❌ CTA error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Webhook Server Running!');
  console.log(`🔑 Trigger keyword: "${TRIGGER_KEYWORD}"`);
  console.log('⏳ Waiting for messages...\n');
});
