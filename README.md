# SpecMode Discord Bot

Minimal Discord bot + HTTP server to link Minecraft UUIDs to Discord users and move them to a voice channel.

Setup
- Create a bot in the Discord developer portal.
- Enable "Message Content Intent".
- Invite the bot with "Move Members" permission.
- Copy `config.json` and fill in token, guildId, secret, port.

Run
1) `npm install`
2) `npm start`

Link flow
1) In Minecraft: `/spec link` to get a code.
2) In Discord: `!link <code>` in any channel.

Move flow
- In Minecraft menu: shift + right click a player head.
- The plugin sends a request to the bot, which moves the linked Discord user.
