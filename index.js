import fs from "fs";
import path from "path";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";

const configPath = path.resolve("config.json");
let fileConfig = {};
if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error("Failed to read config.json", err);
  }
}

const config = {
  token: process.env.DISCORD_TOKEN || fileConfig.token,
  guildId: process.env.DISCORD_GUILD_ID || fileConfig.guildId,
  port: Number(process.env.PORT || fileConfig.port || 3000),
  secret: process.env.BOT_SECRET || fileConfig.secret
};

const dataDir = path.resolve("data");
const linksFile = path.join(dataDir, "links.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let links = {};
if (fs.existsSync(linksFile)) {
  try {
    links = JSON.parse(fs.readFileSync(linksFile, "utf8"));
  } catch (err) {
    console.error("Failed to read links.json", err);
  }
}

const pending = new Map();

function saveLinks() {
  fs.writeFileSync(linksFile, JSON.stringify(links, null, 2));
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  return header === `Bearer ${config.secret}`;
}

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.post("/link/register", (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { code, uuid, name } = req.body || {};
  if (!code || !uuid) {
    return res.status(400).json({ error: "missing_fields" });
  }
  pending.set(code, {
    uuid,
    name: name || "unknown",
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  return res.status(200).json({ ok: true });
});

app.post("/move", async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { uuid, channelId } = req.body || {};
  if (!uuid || !channelId) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const discordId = links[uuid];
  if (!discordId) {
    return res.status(404).json({ error: "not_linked" });
  }
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const member = await guild.members.fetch(discordId);
    if (!member.voice || !member.voice.channelId) {
      return res.status(409).json({ error: "not_in_voice" });
    }
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isVoiceBased()) {
      return res.status(400).json({ error: "invalid_channel" });
    }
    await member.voice.setChannel(channel);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Move error", err);
    return res.status(500).json({ error: "move_failed" });
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on("ready", () => {
  console.log(`Bot online as ${client.user?.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }
  const content = message.content.trim();
  if (!content.startsWith("!link ")) {
    return;
  }
  const code = content.slice("!link ".length).trim();
  const entry = pending.get(code);
  if (!entry) {
    await message.reply("Invalid or expired code.");
    return;
  }
  if (Date.now() > entry.expiresAt) {
    pending.delete(code);
    await message.reply("Code expired.");
    return;
  }
  links[entry.uuid] = message.author.id;
  pending.delete(code);
  saveLinks();
  await message.reply("Link complete. You can return in game.");
});

client.login(config.token);

app.listen(config.port, () => {
  console.log(`HTTP server on :${config.port}`);
});
