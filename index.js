async function getGroupInfo(sock, groupJid, senderJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const myId = sock.user.id.split(':')[0].split('@')[0];
    const me = meta.participants.find((p) => p.id.split(':')[0].split('@')[0] === myId);
    const sender = meta.participants.find((p) => p.id === senderJid);
    return { botIsAdmin: !!me?.admin, senderIsAdmin: !!sender?.admin };
  } catch {
    return { botIsAdmin: false, senderIsAdmin: false };
  }
}

function remember(groupJid, line) {
  const arr = groupHistory.get(groupJid) || [];
  arr.push(line);
  if (arr.length > 40) arr.shift();
  groupHistory.set(groupJid, arr);
}

async function aiReply(groupJid, prompt) {
  if (!model) return null;
  const history = (groupHistory.get(groupJid) || []).join('\n');
  const full =
    'You are a member of a WhatsApp group. Read the recent chat below and reply in the same ' +
    'language, tone, slang and message length that the members use. Keep it short, casual ' +
    'and natural. Never mention that you are an AI or a bot.\n\n' +
    'Recent chat:\n' + history + '\n\n' + prompt + '\n\nYour reply:';
  try {
    const res = await model.generateContent(full);
    return res.response.text().trim();
  } catch (e) {
    console.error('AI error:', e.message);
    return null;
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['GroupGuard', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Scan this QR code with WhatsApp on the bot number:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('Bot is online.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Connection lost, reconnecting...');
        start();
      } else {
        console.log('Logged out. Delete the auth_info folder and scan again.');
      }
    }
  });

  // Occasional welcome for new members
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action !== 'add') return;
    if (Math.random() > WELCOME_CHANCE) return;
    for (const user of participants) {
      const jid = typeof user === 'string' ? user : user.id;
      const text =
        (await aiReply(id, 'Write a one line friendly welcome for a new member who just joined.')) ||
        'Welcome to the group!';
      await sock.sendMessage(id, {
        text: '@' + jid.split('@')[0] + ' ' + text,
        mentions: [jid],
      });
    }
  });
