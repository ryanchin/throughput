# Teams Bot Setup Guide

Step-by-step instructions for configuring the Throughput CRM Bot in Microsoft Teams.

---

## Prerequisites

- An Azure subscription (the Ascendion corporate subscription works)
- Azure AD admin access (or an admin to approve the app registration)
- Teams admin center access (to upload custom apps)
- The Throughput app deployed to Vercel

---

## Step 1: Register an Azure AD App

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Configure:
   - **Name:** `Throughput CRM Bot`
   - **Supported account types:** "Accounts in this organizational directory only" (single-tenant)
   - **Redirect URI:** Leave blank (not needed for bot)
4. Click **Register**
5. Note the **Application (client) ID** — this is `TEAMS_BOT_APP_ID`
6. Note the **Directory (tenant) ID** — this is `TEAMS_BOT_TENANT_ID`
7. Go to **Certificates & secrets** > **New client secret**
   - Description: `Throughput Bot Secret`
   - Expiry: 24 months
   - Copy the **Value** — this is `TEAMS_BOT_APP_SECRET`

---

## Step 2: Create a Bot Service Resource

1. Go to [Azure Portal > Create a resource](https://portal.azure.com/#create/hub)
2. Search for **Azure Bot** and select it
3. Configure:
   - **Bot handle:** `throughput-crm-bot`
   - **Subscription:** Your Azure subscription
   - **Resource group:** Create new or use existing
   - **Pricing tier:** F0 (free — up to 10,000 messages/month)
   - **Microsoft App ID:** Select "Use existing app registration"
   - Enter the App ID from Step 1
4. Click **Create**

---

## Step 3: Configure the Messaging Endpoint

1. Go to your Bot Service resource in Azure Portal
2. Navigate to **Configuration**
3. Set the **Messaging endpoint** to:
   ```
   https://throughput.vercel.app/api/teams/messages
   ```
   (Replace with your actual Vercel domain)
4. Click **Apply**

---

## Step 4: Enable the Teams Channel

1. In your Bot Service resource, go to **Channels**
2. Click **Microsoft Teams**
3. Accept the terms of service
4. Click **Apply**

---

## Step 5: Create a Teams App Manifest

Create a file `teams-manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<TEAMS_BOT_APP_ID>",
  "developer": {
    "name": "AAVA Product Studio",
    "websiteUrl": "https://throughput.vercel.app",
    "privacyUrl": "https://throughput.vercel.app/privacy",
    "termsOfUseUrl": "https://throughput.vercel.app/terms"
  },
  "name": {
    "short": "Throughput CRM",
    "full": "Throughput CRM Bot"
  },
  "description": {
    "short": "Update your CRM deals from Teams",
    "full": "Send natural language deal updates to the Throughput CRM bot. Log activities, update stages, and create tasks without leaving Teams."
  },
  "icons": {
    "outline": "outline-32x32.png",
    "color": "color-192x192.png"
  },
  "accentColor": "#00D4FF",
  "bots": [
    {
      "botId": "<TEAMS_BOT_APP_ID>",
      "scopes": ["personal", "team"],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal"],
          "commands": [
            {
              "title": "update",
              "description": "Send a natural language CRM update"
            },
            {
              "title": "help",
              "description": "Show usage examples"
            }
          ]
        }
      ]
    }
  ],
  "permissions": ["messageTeamMembers"],
  "validDomains": ["throughput.vercel.app"]
}
```

Replace `<TEAMS_BOT_APP_ID>` with your actual App ID.

---

## Step 6: Package and Upload to Teams

1. Create two icon files:
   - `outline-32x32.png` — 32x32px transparent outline icon
   - `color-192x192.png` — 192x192px color icon
2. Zip the manifest + icons into a `.zip` file:
   ```bash
   zip throughput-crm-bot.zip teams-manifest.json outline-32x32.png color-192x192.png
   ```
3. Go to [Teams Admin Center > Manage apps](https://admin.teams.microsoft.com/policies/manage-apps)
4. Click **Upload custom app** > **Upload for your org**
5. Select the `.zip` file
6. The app will appear in the org's app catalog

---

## Step 7: Set Environment Variables

Add these to your Vercel project (Settings > Environment Variables):

```
TEAMS_BOT_APP_ID=<Application (client) ID from Step 1>
TEAMS_BOT_APP_SECRET=<Client secret value from Step 1>
TEAMS_BOT_TENANT_ID=<Directory (tenant) ID from Step 1>
```

Redeploy after setting the variables.

---

## Step 8: Test the Bot

1. In Microsoft Teams, click **Apps** in the left sidebar
2. Search for "Throughput CRM"
3. Click **Add** to install the bot
4. Open a chat with the bot
5. Send a test message: `Had a call with Acme Corp about the Q3 renewal`
6. You should see an Adaptive Card with the parsed actions
7. Click **Apply Selected** to apply the actions to the CRM

---

## Troubleshooting

### Bot doesn't respond
- Check that the messaging endpoint URL is correct in Azure Bot Service configuration
- Verify the environment variables are set in Vercel
- Check Vercel function logs for errors

### "I don't recognize your account"
- The bot matches users by their Teams display name against `profiles.full_name`
- Ensure the user's Teams display name exactly matches their CRM profile name
- This will be improved in v2 with email-based matching via Microsoft Graph API

### Token errors
- Regenerate the client secret in Azure AD if it has expired
- Update `TEAMS_BOT_APP_SECRET` in Vercel
- Redeploy

### Actions fail to apply
- Check that the company names in the CRM match what the salesperson is saying
- The bot uses fuzzy matching but may not find companies with very different names
- Check Vercel function logs for specific error messages

---

## Architecture Notes

The bot uses raw HTTP calls to the Bot Framework REST API (no botbuilder SDK) to stay compatible with Vercel's serverless functions. The flow is:

```
Teams User → Azure Bot Service → POST /api/teams/messages (Vercel)
                                        │
                                        ├─► Validate JWT token
                                        ├─► Identify user (name → profiles)
                                        ├─► Parse NL text (OpenRouter LLM)
                                        ├─► Build Adaptive Card
                                        └─► Reply via Bot Framework REST API
```

All outbound calls to Bot Framework use an OAuth2 client_credentials token cached in memory.
