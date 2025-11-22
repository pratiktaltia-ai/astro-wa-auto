const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Env tokens from Render/.env
const NETCORE_API_KEY = process.env.WHATSAPP_TOKEN;
const NETCORE_SOURCE = process.env.PHONE_NUMBER_ID;

// NEW trigger keyword
const TRIGGER_KEYWORD = '#0099#';

app.get('/', (req, res) => {
  res.send('✅ Webhook server is running!');
});

app.post('/webhook', async (req, res) => {
  console.log('\n📨 WEBHOOK RECEIVED');
  console.log('📦 FULL BODY:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'received' });

  try {
    const body = req.body;
    let userPhone = null;
    let messageText = null;

    // Netcore format
    if (body.incoming_message && body.incoming_message[0]) {
      const message = body.incoming_message[0];
      userPhone = message.from;
      if (message.text_type && message.text_type.text) {
        messageText = message.text_type.text;
      }
    }
    // Fallback/simple
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

    if (messageText.includes(TRIGGER_KEYWORD)) {
      console.log(`✅ Trigger matched! Sending 3 astrology messages...`);

      if (!NETCORE_API_KEY || !NETCORE_SOURCE) {
        console.log('⚠️  Tokens not configured in Secrets');
        return;
      }

      await sendThreeAstroMessages(userPhone);
    } else {
      console.log(`⏭️  Trigger not matched. Received: "${messageText}"`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
});

async function sendThreeAstroMessages(userPhone) {
  try {
    // 1️⃣
    console.log('📤 Message 1/3...');
    await sendNetcoreMessage(
      userPhone,
      '🔍 Jyotish Premanand ji ki availability check ho rahi hai…'
    );
    await sleep(2000);

    // 2️⃣
    console.log('📤 Message 2/3...');
    await sendNetcoreMessage(
      userPhone,
      '⏳ Woh abhi kisi aur vyakti ke saath busy hain. Jaise hi free honge, aapko turant update milega.'
    );
    await sleep(5000);

    // 3️⃣
    console.log('📤 Message 3/3...');
    await sendNetcoreMessage(
      userPhone,
      '✨ Jyotishi Premanand ji ab free hain — aapka intezaar kar rahe hain! https://neoastr.onelink.me/bBHP/optxcyo9'
    );

    console.log('✅ All 3 astrology messages sent!\n');
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Webhook Server Running!');
  console.log(`🔑 Astro Trigger keyword: "${TRIGGER_KEYWORD}"`);
  console.log('⏳ Waiting for messages...\n');
});
