# MuchoMoney8s Discord Bot Setup

The Discord interaction backend is deployed as the Supabase Edge Function:

`mucho8s-discord-bot`

Interaction endpoint:

`https://qddhlwixlarygncwabuv.supabase.co/functions/v1/mucho8s-discord-bot`

## Required Discord application settings

1. Open the MuchoMoney8s application in Discord Developer Portal.
2. Copy the application's **Public Key**.
3. Store it in Supabase Edge Function secrets as `DISCORD_PUBLIC_KEY`.
4. Set the Interaction Endpoint URL to the endpoint above.
5. Register the slash commands defined in:
   `supabase/functions/mucho8s-discord-bot/commands.json`

For automatic command registration, keep the Discord application ID and bot token outside the repository and use them only as deployment/runtime secrets.

## Commands prepared

- `/help`
- `/ranking`
- `/player name:<nickname>`
- `/chall player:<Discord user> amount:<EUR> platform:<paypal|revolut|cmg>`
- `/ready`
- `/match`

The bot verifies Discord request signatures before processing commands. Never commit the Discord bot token or other private credentials to GitHub.
