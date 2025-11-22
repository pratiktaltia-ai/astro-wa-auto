const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

// ENV vars for Netcore API
const NETCORE_API_KEY = process.env.WHATSAPP_TOKEN;
const NETCORE_SOURCE = process.env.PHONE_NUMBER_ID;

// Netcore IP whitelist
const netcoreIPs = [
  '3.109.231.61',
  '3.6.178.98',
  '13.127.49.56',
  '13.126.62.29',
  '35.244.61.191',
  '139.59.22.149'
];

// Get client IP (use x-forwarded-for first if present)
function getClientIp(req) {
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || '';
}

// Load triggers from JSON
let triggers = [];
function loadTriggers() {
  const triggersPath = path.join(__dirname, 'triggers.json');
  try {
    triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
    console.log('Triggers file loaded. Count:', triggers.length);
  } catch (err) {
    console.error('Error loading triggers.json:', err.message);
    triggers = [];
  }
}
loadTriggers();
setInterval(loadTriggers, 60000); // auto reload triggers every 1 min

// Cooldown map : userPhone -> last trigger timestamp
const userCooldowns = new Map();

app.get('/', (req, res) => {
  res.send('✅ Webhook server is running!');
});

app.post('/webhook', async (req, res) => {
  // Log all IP info (for debugging)
  console.log('IP Debug:', {
    'x-forwarded-for': req.headers['x-forwarded-for'],
    remoteAddress: req.connection.remoteAddress,
    ip: req.ip
  });

  const remoteIP = getClientIp(req);
  if (!isFromNetcore(remoteIP)) {
    console.log(`❌ Blocked webhook from non-Netcore IP: ${remoteIP}`);
    res.status(403).send('Forbidden');
    return;
  }

  const body = req.body;
  let userPhone = null;
  let messageText = null;

  // Extract Netcore payload
  if (body.incoming_message && body.incoming_message[0]) {
    const message = body.incoming_message[0];
    userPhone = message.from;
    if (message.text_type && message.text_type.text) {
      messageText = message.text_type.text;
    }
  } else if (body.from && body.text) {
    userPhone = body.from;
    messageText = body.text;
  }

  if (!userPhone || !messageText) {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  // Per-user cooldown (1 min)
  const cooldownMs = 60000;
  const now = Date.now();
  const lastTrigger = userCooldowns.get(userPhone) || 0;
  if (now - lastTrigger < cooldownMs) {
    res.status(200).json({ status: 'cooldown' });
    return;
  }
  userCooldowns.set(userPhone, now);

  // Match trigger
  const matchedTrigger = triggers.find(tg =>
    messageText.toLowerCase().includes(tg.trigger.toLowerCase())
  );

  if (matchedTrigger && matchedTrigger.sequence.length) {
    for (const [i, step] of matchedTrigger.sequence.entries()) {
      if (step.delay && step.delay > 0) await sleep(step.delay);

      // Send plain text or CTA based on step
      if (typeof step.message === 'string') {
        await sendNetcoreTextMessage(userPhone, step.message);
      }
      else if (step.message.type === 'cta') {
        await sendNetcoreCTAMessage(userPhone, step.message);
      }
    }
  }

  res.status(200).json({ status: 'received' });
});

// Send basic text message
async function sendNetcoreTextMessage(to, text) {
  try {
    await axios.post(
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
  } catch (error) {
    console.error('❌ Text send error:', error.message);
    if (error.response) {
      console.error('❌', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Send CTA button message
async function sendNetcoreCTAMessage(to, cta) {
  try {
    await axios.post(
      'https://cpaaswa.netcorecloud.net/api/v2/message/nc/message/',
      {
        message: [
          {
            cta_link_track: cta.cta_link_track || "1",
            recipient_whatsapp: to,
            message_type: "interactive",
            recipient_type: "individual",
            source: NETCORE_SOURCE,
            'x-apiheader': 'astro_automation',
            type_interactive: [
              {
                type: "cta_url",
                header: {
                  type: "text",
                  url: cta.cta_url
                },
                body: cta.body,
                action: [
                  {
                    buttons: [
                      {
                        name: "shop_now",
                        parameters: {
                          display_text: cta.button_text,
                          url: cta.cta_url
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
  } catch (error) {
    console.error('❌ CTA send error:', error.message);
    if (error.response) {
      console.error('❌', JSON.stringify(error.response.data, null, 2));
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 Webhook Server Running!');
});
