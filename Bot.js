  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'close') {
      const code = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output
        ? u.lastDisconnect.error.output.statusCode : 0;
      if (code !== DisconnectReason.loggedOut) {
        startBot(number);
      } else {
        delete sessions[number];
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
