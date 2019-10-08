//  __   __  ___        ___
// |__) /  \  |  |__/ |  |  
// |__) \__/  |  |  \ |  |  

// This is the main file for the Prototypes Builder bot.

// Import Botkit's core features
const { Botkit } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

const slackUrl = 'https://hooks.slack.com/services/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';

// Import a platform-specific adapter for slack.

const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');

const { MongoDbStorage } = require('botbuilder-storage-mongodb');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
    storage = mongoStorage = new MongoDbStorage({
        url : process.env.MONGO_URI,
    });
}



const adapter = new SlackAdapter({
    // REMOVE THIS OPTION AFTER YOU HAVE CONFIGURED YOUR APP!
    enable_incomplete: true,

    // parameters used to secure webhook endpoint
    verificationToken: process.env.verificationToken,
    clientSigningSecret: process.env.clientSigningSecret,  

    // auth token for a single-team app
    botToken: process.env.botToken,

    // credentials used to set up oauth for multi-team apps
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'], 
    redirectUri: process.env.redirectUri,
 
    // functions required for retrieving team-specific info
    // for use in multi-team apps
    getTokenForTeam: getTokenForTeam,
    getBotUserByTeam: getBotUserByTeam,
});

// Use SlackEventMiddleware to emit events that match their original Slack event types.
adapter.use(new SlackEventMiddleware());

// Use SlackMessageType middleware to further classify messages as direct_message, direct_mention, or mention
adapter.use(new SlackMessageTypeMiddleware());


const controller = new Botkit({
    webhook_uri: '/api/slack',

    adapter: adapter,

    storage
});

if (process.env.cms_uri) {
    controller.usePlugin(new BotkitCMSHelper({
        uri: process.env.cms_uri,
        token: process.env.cms_token,
    }));
}

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {

    // load traditional developer-created local custom feature modules
    controller.loadModules(__dirname + '/features');

    /* catch-all that uses the CMS to trigger dialogs */
    if (controller.plugins.cms) {
        controller.on('message,direct_message', async (bot, message) => {
            let results = false;
            results = await controller.plugins.cms.testTrigger(bot, message);

            if (results !== false) {
                // do not continue middleware!
                return false;
            }
        });
    }

});

controller.on('slash_command',function(bot,message) 
{
    // reply to slash command
    // bot.replyPublic(message,'Everyone can see this part of the slash command');
    // bot.replyPrivate(message,'Only the person who used the slash command can see this.');

})


controller.webserver.get('/', (req, res) => {
    //console.log(adapter);
    res.send(`This app is running Botkit ${ controller.version }.`);
});



controller.webserver.get('/install', (req, res) => {
    // getInstallLink points to slack's oauth endpoint and includes clientId and scopes
    res.redirect(controller.adapter.getInstallLink());
});

controller.webserver.get('/install/auth', async (req, res) => {
    try {
        const results = await controller.adapter.validateOauthCode(req.query.code);

        console.log('FULL OAUTH DETAILS', results);

        // Store token by team in bot state.
        tokenCache[results.team_id] = results.bot.bot_access_token;

        // Capture team to bot id
        userCache[results.team_id] =  results.bot.bot_user_id;

        res.json('Success! Bot installed.');

    } catch (err) {
        console.error('OAUTH ERROR:', err);
        res.status(401);
        res.send(err.message);
    }
});

let tokenCache = {};
let userCache = {};

if (process.env.TOKENS) {
    tokenCache = JSON.parse(process.env.TOKENS);
} 

if (process.env.USERS) {
    userCache = JSON.parse(process.env.USERS);
} 

async function getTokenForTeam(teamId) {
    if (tokenCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(function() {
                resolve(tokenCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in tokenCache: ', teamId);
    }
}

async function getBotUserByTeam(teamId) {
    if (userCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(function() {
                resolve(userCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in userCache: ', teamId);
    }
}




//=======UNITY CLOUD



var payload = 
    {
    "type": "modal",
    "title": {
        "type": "plain_text",
        "text": "My App",
        "emoji": true
    },
    "submit": {
        "type": "plain_text",
        "text": "Submit",
        "emoji": true
    },
    "close": {
        "type": "plain_text",
        "text": "Cancel",
        "emoji": true
    },
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Select whose game do you want to build"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a user",
                        "emoji": true
                    }
                }
            ]
        }
    ]
};

// get details on shared build (links.icon.href links.download_primary.href)
// https://build-api.cloud.unity3d.com/api/v1/shares/{shareid}

// get shareId
// https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/prototypes-oles/buildtargets/ios/builds/19/share

// get buildStatus (scmBranch)
// https://build-api.cloud.unity3d.com/api/v1/orgs/{orgid}/projects/{projectid}/buildtargets/{buildtargetid}/builds/{number}

//failure
//queued
//success
//canceled
//started

unityHeaders = { "Content-type" : "application/json",
        'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};
slackHeaders = { 'Content-type' : 'application/json' };

controller.webserver.post('/api/unitycloud', (req, res) => 
{
    var body = req.body;
    if (req.body.buildStatus == "failure")
    {
        onBuildFailed(body);
    }
    if (req.body.buildStatus == "queued")
    {
        onBuildQueued(body);
    }
    if (req.body.buildStatus == "success")
    {
        onBuildSuccess(body);
    }
    if (req.body.buildStatus == "canceled")
    {
        onBuildCanceled(body);
    }
    if (req.body.buildStatus == "started")
    {
        onBuildStarted(body);
    }
     
   // var body = JSON.stringify(payload);
   // fetch(slackUrl, { method: 'POST', headers: 'Content-type: application/json', body : '{"text":"Hello, World!"}' }).then(res => console.log(res));

    // fetch(slackUrl, {
    //   method: 'get',
    //   headers: unityHeaders
    // }).then(res => console.log(res));
    res.send(`Ok.`);
});

function getBuildStatusURL(buildData)
{
    var projectid = buildData.projectid;
    var buildtargetid = buildData.buildtargetid;
    var build = buildData.build;

    return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + projectid + '/buildtargets/' + buildtargetid + '/builds/' + build;
}

function getShareIdURL(buildData)
{
    var projectid = buildData.projectid;
    var buildtargetid = buildData.buildtargetid;
    var build = buildData.build;

    return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + projectid + '/buildtargets/' + buildtargetid + '/builds/' + build + "/share";
}

function hyphenize(str)
{
    return str.replace(/\s+/g, '-').toLowerCase();
}

function getBuildData(body)
{
    return {projectid: hyphenize(body.projectName), buildtargetid: hyphenize(body.buildTargetName), build: body.buildNumber, platform : body.platform};
}


function getBuildStartedPayload()
{
    payload = {"text" : "buildStarted"}

    return JSON.stringify(payload);
}

async function onBuildStarted(body)
{
    var buildData = getBuildData(body);
    var buildStatus = await getBuildStatus(buildData);

    var branch = buildStatus.scmBranch;

    await say(getBuildInfoPrefix(buildStatus) + " started! :building_construction:");  
}

async function getShareId(buildData)
{
    var res = await fetch(getShareIdURL(buildData), {
      method: 'get',
      headers: unityHeaders
    });
    resJson = await res.json();
    return resJson;
}

async function getShareDetails(shareId)
{
    var res = await fetch("https://build-api.cloud.unity3d.com/api/v1/shares/" + shareid, {
      method: 'get',
      headers: unityHeaders
    });
    resJson = await res.json();
    return resJson;
}

async function onBuildSuccess(body)
{
    var buildData = getBuildData(body);
    var buildStatus = await getBuildStatus(buildData);
    var shareId = await getShareId(buildData);
    var shareDetails = await getShareDetails(shareId);

    var branch = buildStatus.scmBranch;
    
    var message = {};
    message.text = getBuildInfoPrefix(buildStatus) + " successfuly finished! :classical_building: :checkered_flag:";
    message.icon = shareDetails.links.icon.href;
    
    var shareLink = "https://developer.cloud.unity3d.com/share/share.html?shareId=" + shareId;

    await sayDownloadApp(message + "\n*<" + shareLink + "|Download>*");  
}


async function getBuildStatus(buildData)
{
    var res = await fetch(getBuildStatusURL(buildData), {
      method: 'get',
      headers: unityHeaders
    });
    resJson = await res.json();
    return resJson;
}

function getBuildInfoPrefix(buildStatus)
{
    return "*:" + buildStatus.platform + ": (" + buildStatus.scmBranch + ")* build *#" + buildStatus.build + "* ";
}

async function onBuildQueued(body)
{
    var buildData = getBuildData(body);
    var buildStatus = await getBuildStatus(buildData);
    console.log(buildStatus);
    var branch = buildStatus.scmBranch;

    await say(getBuildInfoPrefix(buildStatus) + " was put into queue :vertical_traffic_light: ");  
}

async function onBuildCanceled(body)
{
    var buildData = getBuildData(body);
    var buildStatus = await getBuildStatus(buildData);

    var branch = buildStatus.scmBranch;

    await say(getBuildInfoPrefix(buildStatus) + " was canceled :heavy_multiplication_x:");  
}

async function onBuildFailed(body)
{
    var buildData = getBuildData(body);
    var buildStatus = await getBuildStatus(buildData);

    var branch = buildStatus.scmBranch;

    await say(getBuildInfoPrefix(buildStatus) + " FAILED :x:");  
}


async function say(message)
{
    console.log("saying to: " + slackUrl);
    await fetch(slackUrl, {
      method: 'POST',
      headers: slackHeaders,
      body: JSON.stringify({
            "type": "modal",
    "title": {
        "type": "plain_text",
        "text": "My App",
        "emoji": true
    },
    "submit": {
        "type": "plain_text",
        "text": "Submit",
        "emoji": true
    },
    "close": {
        "type": "plain_text",
        "text": "Cancel",
        "emoji": true
    },
    "blocks": [
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": message
                }
            ]
        }
    ]
})
    });
}

async function sayDownloadApp(message)
{

    await fetch(slackUrl, {
      method: 'POST',
      headers: slackHeaders,
      body: JSON.stringify({
            "type": "modal",
    "title": {
        "type": "plain_text",
        "text": "My App",
        "emoji": true
    },
    "submit": {
        "type": "plain_text",
        "text": "Submit",
        "emoji": true
    },
    "close": {
        "type": "plain_text",
        "text": "Cancel",
        "emoji": true
    },
            "blocks": [
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "image",
                            "image_url": message.icon,
                            "alt_text": "images"
                        },
                        {
                            "type": "mrkdwn",
                            "text": message.text
                        }
                    ]
                }
            ]
        })
    });
}