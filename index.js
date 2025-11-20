const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.set('port', process.env.PORT || 3000);

// Get tokens from Secrets
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Your trigger keyword
const TRIGGER_KEYWORD = '7358433457';

// Test endpoint
app.get('/', (req, res) => {
  res.send('✅ Webhook server is running!');
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  console.log('\n📨 WEBHOOK RECEIVED');

  // Respond immediately
  res.status(200).json({ status: 'received' });

  try {
    const body = req.body;
    let userPhone = null;
    let messageText = null;

    // Extract phone and message text
    if (body.entry && body.entry[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      userPhone = message.from;

      // Get text from message
      if (message.type === 'text') {
        messageText = message.text.body;
      } else if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
        // If it's a button, check button title or payload
        messageText = message.interactive.button_reply.title || message.interactive.button_reply.id;
      }
    } else if (body.from && body.text) {
      // Netcore format
      userPhone = body.from;
      messageText = body.text;
    }

    if (!userPhone || !messageText) {
      console.log('⏭️  No phone/text found, skipping');
      return;
    }

    console.log(`📞 From: ${userPhone}`);
    console.log(`💬 Message: "${messageText}"`);

    // CHECK: Does message contain trigger keyword?
    if (messageText.includes(TRIGGER_KEYWORD)) {
      console.log(`✅ KEYWORD MATCHED! Sending 3 messages...`);

      if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
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

// Send 3 messages with delays
async function sendThreeMessages(userPhone) {
  try {
    // Message 1
    console.log('📤 Message 1/3...');
    await sendWhatsAppMessage(userPhone, 
      "✨ Your stars are aligning in a powerful way today...");

    await sleep(2000);

    // Message 2
    console.log('📤 Message 2/3...');
    await sendWhatsAppMessage(userPhone, 
      "🔮 Our astrologer discovered something fascinating about your birth chart...");

    await sleep(2000);

    // Message 3
    console.log('📤 Message 3/3...');
    await sendWhatsAppMessage(userPhone, 
      "💫 This reading is time-sensitive. Open your app now 👉 https://neoastro.app");

    console.log('✅ All 3 messages sent!\n');

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

// Send WhatsApp message
async function sendWhatsAppMessage(to, text) {
  const response = await axios.post(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    },
    {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log(`   ✓ Sent (ID: ${response.data.messages[0].id})`);
  return response.data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start server
const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Webhook Server Running!');
  console.log(`🔑 Trigger keyword: "${TRIGGER_KEYWORD}"`);
  console.log('⏳ Waiting for messages...\n');
});
